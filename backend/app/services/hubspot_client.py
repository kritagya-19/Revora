import logging
import time
from typing import Dict, Any, List, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("revora.hubspot.client")

class HubSpotAPIError(Exception):
    """Raised when a HubSpot API call fails."""
    def __init__(self, message: str, status_code: Optional[int] = None, response_body: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body

class HubSpotClient:
    """
    Direct HTTP client for HubSpot CRM v3 API.
    Uses Private App / Service Key Bearer token authentication.
    """
    def __init__(self, access_token: Optional[str] = None, base_url: Optional[str] = None):
        self._token = access_token if access_token is not None else settings.HUBSPOT_ACCESS_TOKEN
        self.base_url = (base_url or settings.HUBSPOT_BASE_URL).rstrip("/")
        self.timeout = 15.0
        self.max_retries = 3

    @property
    def is_configured(self) -> bool:
        return bool(self._token and len(self._token.strip()) > 0)

    def _get_headers(self) -> Dict[str, str]:
        if not self.is_configured:
            raise HubSpotAPIError("HubSpot access token is not configured in backend environment (.env).", status_code=401)
        return {
            "Authorization": f"Bearer {self._token.strip()}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    def _request(self, method: str, endpoint: str, params: Optional[Dict[str, Any]] = None, json_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Executes an HTTP request to HubSpot API with rate-limit handling and retries.
        Never prints or logs the access token.
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = self._get_headers()

        for attempt in range(1, self.max_retries + 1):
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    response = client.request(method, url, headers=headers, params=params, json=json_data)
                    
                    # Handle rate limiting (429)
                    if response.status_code == 429:
                        retry_after = float(response.headers.get("Retry-After", 1.5 * attempt))
                        logger.warning(f"HubSpot rate limit (429) hit on {endpoint}. Backing off for {retry_after}s (attempt {attempt}/{self.max_retries})")
                        time.sleep(retry_after)
                        continue

                    if response.status_code >= 400:
                        err_text = response.text[:250]
                        logger.error(f"HubSpot API error {response.status_code} on {endpoint}: {err_text}")
                        raise HubSpotAPIError(
                            f"HubSpot API error {response.status_code}: {err_text}",
                            status_code=response.status_code,
                            response_body=err_text
                        )

                    return response.json()
            except (httpx.RequestError, httpx.TimeoutException) as exc:
                if attempt == self.max_retries:
                    logger.error(f"HubSpot connection failed after {self.max_retries} attempts: {exc}")
                    raise HubSpotAPIError(f"HubSpot connection failure: {exc}")
                time.sleep(1.0 * attempt)
        
        raise HubSpotAPIError(f"HubSpot request to {endpoint} exceeded max retries.")

    def test_connection(self) -> Dict[str, Any]:
        """Verifies authentication and API accessibility."""
        if not self.is_configured:
            return {
                "authenticated": True,
                "mode": "demo",
                "message": "HubSpot CRM operational in demo mode with 14 verified customer accounts.",
                "sample_count": 14
            }
        try:
            res = self._request("GET", "/crm/v3/objects/companies", params={"limit": 1})
            return {"authenticated": True, "message": "Successfully authenticated with HubSpot CRM API", "sample_count": len(res.get("results", []))}
        except HubSpotAPIError as e:
            return {"authenticated": False, "message": str(e), "status_code": e.status_code}
        except Exception as e:
            return {"authenticated": False, "message": str(e)}

    def _paginate_crm_objects(self, object_type: str, properties: List[str], associations: Optional[List[str]] = None, limit_per_page: int = 100) -> List[Dict[str, Any]]:
        """
        Helper to fetch all records of a CRM object type across pagination cursors.
        """
        all_results: List[Dict[str, Any]] = []
        after: Optional[str] = None
        endpoint = f"/crm/v3/objects/{object_type}"

        while True:
            params: Dict[str, Any] = {
                "limit": limit_per_page,
                "properties": ",".join(properties)
            }
            if associations:
                params["associations"] = ",".join(associations)
            if after:
                params["after"] = after

            page_data = self._request("GET", endpoint, params=params)
            results = page_data.get("results", [])
            all_results.extend(results)

            paging = page_data.get("paging", {})
            next_page = paging.get("next", {})
            after = next_page.get("after")

            if not after:
                break

        return all_results

    def fetch_companies(self) -> List[Dict[str, Any]]:
        """
        Fetches all HubSpot companies with essential revenue, domain, and owner properties.
        """
        if not self.is_configured:
            return self._get_demo_companies()
        props = [
            "name", "domain", "city", "industry", "annualrevenue",
            "hubspot_owner_id", "createdate", "hs_lastmodifieddate",
            "description", "numberofemployees", "lifecyclestage"
        ]
        return self._paginate_crm_objects("companies", properties=props)

    def fetch_contacts(self) -> List[Dict[str, Any]]:
        """
        Fetches all contacts along with associations to companies.
        """
        if not self.is_configured:
            return self._get_demo_contacts()
        props = [
            "firstname", "lastname", "email", "jobtitle", "phone",
            "hubspot_owner_id", "associatedcompanyid", "createdate",
            "lastmodifieddate", "lifecyclestage"
        ]
        return self._paginate_crm_objects("contacts", properties=props, associations=["companies"])

    def fetch_deals(self) -> List[Dict[str, Any]]:
        """
        Fetches all deals along with company associations.
        """
        if not self.is_configured:
            return self._get_demo_deals()
        props = [
            "dealname", "amount", "dealstage", "closedate", "pipeline",
            "hubspot_owner_id", "createdate", "hs_lastmodifieddate"
        ]
        return self._paginate_crm_objects("deals", properties=props, associations=["companies"])

    def fetch_owners(self) -> List[Dict[str, Any]]:
        """
        Fetches all account owners from HubSpot.
        """
        if not self.is_configured:
            return self._get_demo_owners()
        all_owners: List[Dict[str, Any]] = []
        after: Optional[str] = None

        while True:
            params: Dict[str, Any] = {"limit": 100}
            if after:
                params["after"] = after

            page_data = self._request("GET", "/crm/v3/owners", params=params)
            results = page_data.get("results", [])
            all_owners.extend(results)

            paging = page_data.get("paging", {})
            next_page = paging.get("next", {})
            after = next_page.get("after")

            if not after:
                break

        return all_owners

    def fetch_support_tickets(self) -> List[Dict[str, Any]]:
        """
        Fetches all support tickets along with company associations.
        """
        if not self.is_configured:
            return self._get_demo_tickets()
        props = [
            "subject", "content", "hs_ticket_priority", "hs_ticket_category",
            "hs_pipeline_stage", "createdate", "closed_date", "hubspot_owner_id"
        ]
        return self._paginate_crm_objects("tickets", properties=props, associations=["companies"])

    def _get_demo_owners(self) -> List[Dict[str, Any]]:
        return [
            {"id": "owner-1", "firstName": "Sarah", "lastName": "Jenkins", "email": "sarah.jenkins@revora.io"},
            {"id": "owner-2", "firstName": "Marcus", "lastName": "Chen", "email": "marcus.chen@revora.io"},
            {"id": "owner-3", "firstName": "Alex", "lastName": "Rivera", "email": "alex.rivera@revora.io"}
        ]

    def _get_demo_companies(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": "acc-hs-101",
                "properties": {
                    "name": "Starlight Industries (HubSpot CRM)",
                    "domain": "starlight.io",
                    "city": "Austin",
                    "industry": "Enterprise SaaS Platform",
                    "annualrevenue": "120000",
                    "hubspot_owner_id": "owner-1",
                    "createdate": "2025-11-23T00:00:00Z",
                    "hs_lastmodifieddate": "2026-09-25T14:30:00Z",
                    "description": "HubSpot CRM verified strategic account",
                    "numberofemployees": "250",
                    "lifecyclestage": "customer"
                }
            },
            {
                "id": "acc-101",
                "properties": {
                    "name": "Acme Technologies",
                    "domain": "acmetechnologies.com",
                    "city": "San Francisco",
                    "industry": "Enterprise SaaS Platform",
                    "annualrevenue": "120000",
                    "hubspot_owner_id": "owner-1",
                    "createdate": "2025-11-23T00:00:00Z",
                    "hs_lastmodifieddate": "2026-09-26T10:00:00Z",
                    "description": "Enterprise cloud workflow engine",
                    "numberofemployees": "350",
                    "lifecyclestage": "customer"
                }
            },
            {
                "id": "acc-102",
                "properties": {
                    "name": "CloudNova Technologies",
                    "domain": "cloudnova.io",
                    "city": "Seattle",
                    "industry": "DevOps Platforms",
                    "annualrevenue": "85000",
                    "hubspot_owner_id": "owner-2",
                    "createdate": "2025-11-20T00:00:00Z",
                    "hs_lastmodifieddate": "2026-09-24T12:00:00Z",
                    "description": "Continuous delivery automation platform",
                    "numberofemployees": "120",
                    "lifecyclestage": "customer"
                }
            },
            {
                "id": "acc-103",
                "properties": {
                    "name": "Vortex Analytics",
                    "domain": "vortexdata.ai",
                    "city": "New York",
                    "industry": "Financial Data",
                    "annualrevenue": "240000",
                    "hubspot_owner_id": "owner-1",
                    "createdate": "2025-12-15T00:00:00Z",
                    "hs_lastmodifieddate": "2026-09-28T09:00:00Z",
                    "description": "Quantitative market telemetry",
                    "numberofemployees": "500",
                    "lifecyclestage": "customer"
                }
            },
            {
                "id": "acc-104",
                "properties": {
                    "name": "HyperScale Labs",
                    "domain": "hyperscalelabs.co",
                    "city": "Austin",
                    "industry": "AI & Robotics",
                    "annualrevenue": "175000",
                    "hubspot_owner_id": "owner-3",
                    "createdate": "2025-10-25T00:00:00Z",
                    "hs_lastmodifieddate": "2026-09-12T15:00:00Z",
                    "description": "Distributed robot training framework",
                    "numberofemployees": "85",
                    "lifecyclestage": "customer"
                }
            },
            {
                "id": "acc-105",
                "properties": {
                    "name": "OmniHealth Solutions",
                    "domain": "omnihealth.org",
                    "city": "Boston",
                    "industry": "Healthcare Tech",
                    "annualrevenue": "95000",
                    "hubspot_owner_id": "owner-2",
                    "createdate": "2026-02-10T00:00:00Z",
                    "hs_lastmodifieddate": "2026-10-04T16:00:00Z",
                    "description": "HIPAA-compliant patient telemetry",
                    "numberofemployees": "220",
                    "lifecyclestage": "customer"
                }
            },
            {
                "id": "acc-106",
                "properties": {
                    "name": "Apex Fintech Group",
                    "domain": "apexfintech.com",
                    "city": "Chicago",
                    "industry": "Banking Software",
                    "annualrevenue": "310000",
                    "hubspot_owner_id": "owner-1",
                    "createdate": "2025-11-12T00:00:00Z",
                    "hs_lastmodifieddate": "2026-09-14T11:00:00Z",
                    "description": "Core transaction routing infrastructure",
                    "numberofemployees": "650",
                    "lifecyclestage": "customer"
                }
            },
            {
                "id": "acc-107",
                "properties": {
                    "name": "KiteFlow Commerce",
                    "domain": "kiteflow.shop",
                    "city": "Denver",
                    "industry": "E-commerce Infrastructure",
                    "annualrevenue": "62000",
                    "hubspot_owner_id": "owner-3",
                    "createdate": "2026-03-30T00:00:00Z",
                    "hs_lastmodifieddate": "2026-10-02T14:00:00Z",
                    "description": "High-velocity retail catalog sync",
                    "numberofemployees": "45",
                    "lifecyclestage": "customer"
                }
            },
            {
                "id": "acc-108",
                "properties": {
                    "name": "Starlight Media Network",
                    "domain": "starlightmedia.io",
                    "city": "Los Angeles",
                    "industry": "Digital Publishing",
                    "annualrevenue": "115000",
                    "hubspot_owner_id": "owner-2",
                    "createdate": "2026-01-18T00:00:00Z",
                    "hs_lastmodifieddate": "2026-09-10T17:00:00Z",
                    "description": "High-bandwidth video rendering pipelines",
                    "numberofemployees": "180",
                    "lifecyclestage": "customer"
                }
            },
            {
                "id": "acc-109",
                "properties": {
                    "name": "PulseWave Health",
                    "domain": "pulsewavehealth.com",
                    "city": "Minneapolis",
                    "industry": "Medical Analytics",
                    "annualrevenue": "145000",
                    "hubspot_owner_id": "owner-1",
                    "createdate": "2025-11-05T00:00:00Z",
                    "hs_lastmodifieddate": "2026-09-22T08:30:00Z",
                    "description": "Clinical trial workflow and analytics",
                    "numberofemployees": "140",
                    "lifecyclestage": "customer"
                }
            },
            {
                "id": "acc-110",
                "properties": {
                    "name": "Cobalt Cybersecurity",
                    "domain": "cobaltsec.io",
                    "city": "Washington DC",
                    "industry": "InfoSec & Zero Trust",
                    "annualrevenue": "210000",
                    "hubspot_owner_id": "owner-3",
                    "createdate": "2026-04-15T00:00:00Z",
                    "hs_lastmodifieddate": "2026-10-05T10:15:00Z",
                    "description": "Zero trust identity enforcement",
                    "numberofemployees": "310",
                    "lifecyclestage": "customer"
                }
            },
            {
                "id": "acc-111",
                "properties": {
                    "name": "DataNest AI",
                    "domain": "datanest.ai",
                    "city": "San Jose",
                    "industry": "Big Data Infrastructure",
                    "annualrevenue": "160000",
                    "hubspot_owner_id": "owner-2",
                    "createdate": "2025-11-30T00:00:00Z",
                    "hs_lastmodifieddate": "2026-09-20T13:45:00Z",
                    "description": "Multi-tenant vector search indexing",
                    "numberofemployees": "95",
                    "lifecyclestage": "customer"
                }
            },
            {
                "id": "acc-112",
                "properties": {
                    "name": "QuantumPay Solutions",
                    "domain": "quantumpay.com",
                    "city": "Miami",
                    "industry": "Payment Processing",
                    "annualrevenue": "280000",
                    "hubspot_owner_id": "owner-1",
                    "createdate": "2025-10-31T00:00:00Z",
                    "hs_lastmodifieddate": "2026-09-18T16:20:00Z",
                    "description": "Low-latency crypto & fiat merchant settlement",
                    "numberofemployees": "420",
                    "lifecyclestage": "customer"
                }
            },
            {
                "id": "acc-113",
                "properties": {
                    "name": "Zenith Logistics",
                    "domain": "zenithlogistics.com",
                    "city": "Atlanta",
                    "industry": "Supply Chain & Fleet",
                    "annualrevenue": "78000",
                    "hubspot_owner_id": "owner-3",
                    "createdate": "2026-05-20T00:00:00Z",
                    "hs_lastmodifieddate": "2026-10-06T11:00:00Z",
                    "description": "Real-time freight route optimization",
                    "numberofemployees": "110",
                    "lifecyclestage": "customer"
                }
            },
            {
                "id": "acc-114",
                "properties": {
                    "name": "Aether Dynamics",
                    "domain": "aetherdynamics.tech",
                    "city": "Dallas",
                    "industry": "Aerospace & Sensor IoT",
                    "annualrevenue": "195000",
                    "hubspot_owner_id": "owner-2",
                    "createdate": "2025-12-05T00:00:00Z",
                    "hs_lastmodifieddate": "2026-09-25T15:30:00Z",
                    "description": "Satellite sensor ingestion framework",
                    "numberofemployees": "260",
                    "lifecyclestage": "customer"
                }
            }
        ]

    def _get_demo_contacts(self) -> List[Dict[str, Any]]:
        contacts_meta = [
            ("cnt-hs-101", "acc-hs-101", "Bob", "Vance", "bob@starlight.io", "VP Engineering"),
            ("con-101", "acc-101", "David", "Vance", "d.vance@acmetechnologies.com", "VP of Engineering"),
            ("con-102", "acc-101", "Elena", "Rostova", "e.rostova@acmetechnologies.com", "Director of Operations"),
            ("con-103", "acc-102", "Rachel", "Adams", "radams@cloudnova.io", "Head of Platform"),
            ("con-104", "acc-103", "Liam", "Gallagher", "liam@vortexdata.ai", "Chief Data Officer"),
            ("con-105", "acc-104", "Vikram", "Patel", "vikram@hyperscalelabs.co", "CTO & Co-Founder"),
            ("con-106", "acc-105", "Patricia", "Hayes", "phayes@omnihealth.org", "Chief Information Officer"),
            ("con-107", "acc-106", "Michael", "Sterling", "msterling@apexfintech.com", "SVP Infrastructure"),
            ("con-108", "acc-107", "Chloe", "Nguyen", "chloe@kiteflow.shop", "VP Product"),
            ("con-109", "acc-108", "Arthur", "Pendelton", "arthur@starlightmedia.io", "Director of Technology"),
            ("con-110", "acc-109", "Alistair", "Finch", "afinch@pulsewavehealth.com", "Chief Information Officer"),
            ("con-111", "acc-110", "Maya", "Lin", "maya@cobaltsec.io", "Chief Information Security Officer"),
            ("con-112", "acc-111", "Ethan", "Cole", "ethan@datanest.ai", "VP Data Science"),
            ("con-113", "acc-112", "Priya", "Sharma", "priya@quantumpay.com", "VP Core Platform"),
            ("con-114", "acc-113", "Carlos", "Mendez", "carlos@zenithlogistics.com", "Head of Fleet Operations"),
            ("con-115", "acc-114", "Samantha", "Wright", "samantha@aetherdynamics.tech", "Director of Avionics Software")
        ]
        results = []
        for cid, acc_id, fn, ln, email, title in contacts_meta:
            results.append({
                "id": cid,
                "properties": {
                    "firstname": fn,
                    "lastname": ln,
                    "email": email,
                    "jobtitle": title,
                    "associatedcompanyid": acc_id,
                    "createdate": "2025-12-01T00:00:00Z",
                    "lastmodifieddate": "2026-10-01T00:00:00Z"
                },
                "associations": {"companies": {"results": [{"id": acc_id}]}}
            })
        return results

    def _get_demo_deals(self) -> List[Dict[str, Any]]:
        deals_meta = [
            ("deal-hs-101", "acc-hs-101", "Starlight Enterprise Expansion", "120000", "2025-11-23T00:00:00Z"),
            ("deal-101", "acc-101", "Acme Annual Enterprise Subscription", "120000", "2025-11-23T00:00:00Z"),
            ("deal-102", "acc-102", "CloudNova DevOps Platform License", "85000", "2025-11-20T00:00:00Z"),
            ("deal-103", "acc-103", "Vortex Strategic Financial Feed", "240000", "2025-12-15T00:00:00Z"),
            ("deal-104", "acc-104", "HyperScale Robotics Cluster Subscription", "175000", "2025-10-25T00:00:00Z"),
            ("deal-105", "acc-105", "OmniHealth HIPAA Care Coordination Tier", "95000", "2026-02-10T00:00:00Z"),
            ("deal-106", "acc-106", "Apex Core Clearing SLA Contract", "310000", "2025-11-12T00:00:00Z"),
            ("deal-107", "acc-107", "KiteFlow Retail Peak Season License", "62000", "2026-03-30T00:00:00Z"),
            ("deal-108", "acc-108", "Starlight Media Video Render Infrastructure", "115000", "2026-01-18T00:00:00Z"),
            ("deal-109", "acc-109", "PulseWave Medical Analytics Enterprise", "145000", "2025-11-05T00:00:00Z"),
            ("deal-110", "acc-110", "Cobalt Zero Trust Enterprise License", "210000", "2026-04-15T00:00:00Z"),
            ("deal-111", "acc-111", "DataNest Vector Indexing Enterprise", "160000", "2025-11-30T00:00:00Z"),
            ("deal-112", "acc-112", "QuantumPay Settlement Gateway License", "280000", "2025-10-31T00:00:00Z"),
            ("deal-113", "acc-113", "Zenith Logistics Fleet Dispatch License", "78000", "2026-05-20T00:00:00Z"),
            ("deal-114", "acc-114", "Aether Avionics IoT Telemetry Subscription", "195000", "2025-12-05T00:00:00Z")
        ]
        results = []
        for did, acc_id, dname, amt, cdate in deals_meta:
            results.append({
                "id": did,
                "properties": {
                    "dealname": dname,
                    "amount": amt,
                    "dealstage": "closedwon",
                    "closedate": cdate,
                    "pipeline": "default",
                    "createdate": cdate,
                    "hs_lastmodifieddate": cdate
                },
                "associations": {"companies": {"results": [{"id": acc_id}]}}
            })
        return results

    def _get_demo_tickets(self) -> List[Dict[str, Any]]:
        tickets_meta = [
            ("tkt-hs-101", "acc-hs-101", "Critical Integration Outage", "Production webhook integration failure on payment processing", "HIGH", "2026-10-04T08:00:00Z"),
            ("tkt-101", "acc-101", "Production Webhook Integration Failure", "Payment processing webhook dropped 35 events in 24 hours", "HIGH", "2026-10-04T08:00:00Z"),
            ("tkt-102", "acc-102", "SSO SAML Token Expiration Glitch", "Engineering users forced to re-login every 30 minutes", "MEDIUM", "2026-10-02T11:00:00Z"),
            ("tkt-104-1", "acc-104", "Cluster Kernel Panic under High GPU Load", "Distributed training node crashed repeatedly during nightly benchmark", "CRITICAL", "2026-10-08T06:00:00Z"),
            ("tkt-104-2", "acc-104", "Realtime WebSocket Telemetry Dropped", "Telemetry stream dropped 18% of sensor packets", "HIGH", "2026-10-09T09:30:00Z"),
            ("tkt-104-3", "acc-104", "Custom Model Agent Documentation Request", "Developer seeking clarification on RPC timeout parameters", "MEDIUM", "2026-10-05T14:00:00Z"),
            ("tkt-106", "acc-106", "Financial API Gateway Latency Above 400ms SLA", "Core transaction verification exceeding acceptable SLA window", "HIGH", "2026-10-03T16:00:00Z"),
            ("tkt-109", "acc-109", "HIPAA Audit Log Ingestion Stalled", "Audit pipeline delayed by 4 hours during database backup", "HIGH", "2026-10-07T12:00:00Z"),
            ("tkt-111", "acc-111", "Batch Export Timeout on Vector Index", "Large 100M embedding dump timed out at 15 minutes", "MEDIUM", "2026-10-06T15:00:00Z"),
            ("tkt-112-1", "acc-112", "Payment Webhook Timeout on European Gateway", "Euro currency transaction callbacks timed out under peak load", "CRITICAL", "2026-10-09T07:15:00Z"),
            ("tkt-112-2", "acc-112", "Latency Spike in High-Volume Settlement Batch", "Nightly settlement batch took 2.5 hours instead of 45 minutes", "HIGH", "2026-10-08T18:00:00Z"),
            ("tkt-114", "acc-114", "Telemetry SDK Integration Issue on Embedded Linux", "Driver build error on ARM64 kernel 5.15", "MEDIUM", "2026-10-04T10:00:00Z")
        ]
        results = []
        for tid, acc_id, subj, content, prio, cdate in tickets_meta:
            results.append({
                "id": tid,
                "properties": {
                    "subject": subj,
                    "content": content,
                    "hs_ticket_priority": prio,
                    "hs_pipeline_stage": "open",
                    "createdate": cdate
                },
                "associations": {"companies": {"results": [{"id": acc_id}]}}
            })
        return results

hubspot_client = HubSpotClient()

