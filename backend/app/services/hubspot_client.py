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
            return {"authenticated": False, "message": "HUBSPOT_ACCESS_TOKEN not set"}
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
        props = [
            "dealname", "amount", "dealstage", "closedate", "pipeline",
            "hubspot_owner_id", "createdate", "hs_lastmodifieddate"
        ]
        return self._paginate_crm_objects("deals", properties=props, associations=["companies"])

    def fetch_owners(self) -> List[Dict[str, Any]]:
        """
        Fetches all account owners from HubSpot.
        """
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
        props = [
            "subject", "content", "hs_ticket_priority", "hs_ticket_category",
            "hs_pipeline_stage", "createdate", "closed_date", "hubspot_owner_id"
        ]
        return self._paginate_crm_objects("tickets", properties=props, associations=["companies"])

hubspot_client = HubSpotClient()
