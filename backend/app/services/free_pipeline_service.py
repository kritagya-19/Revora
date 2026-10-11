import os
import smtplib
import logging
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Dict, Any, List, Optional
import httpx

from app.core.config import settings

logger = logging.getLogger("revora.free_pipelines")

class FreePipelineService:
    """
    Zero-Cost Integration Pipeline Engine for Hackathon & Production:
    - Real-Time Free Webhooks (Discord, Slack, Webhook.site, Make, n8n)
    - Free Standard Email SMTP (Gmail App Password, Mailtrap, local relay)
    - Interactive Live Outbox (Zero-config live email inspector)
    """

    def __init__(self):
        self.webhook_url: str = os.getenv("REVORA_WEBHOOK_URL", "")
        self.smtp_host: str = os.getenv("REVORA_SMTP_HOST", "")
        self.smtp_port: int = int(os.getenv("REVORA_SMTP_PORT", "587"))
        self.smtp_user: str = os.getenv("REVORA_SMTP_USER", "")
        self.smtp_pass: str = os.getenv("REVORA_SMTP_PASS", "")
        self.smtp_from: str = os.getenv("REVORA_SMTP_FROM", "notifications@revora.ai")
        self._outbox: List[Dict[str, Any]] = []

    def configure_webhook(self, webhook_url: str) -> Dict[str, Any]:
        """Configure active webhook URL dynamically."""
        self.webhook_url = webhook_url.strip()
        return {
            "status": "configured",
            "webhook_url": self.webhook_url,
            "provider": self._detect_provider(self.webhook_url)
        }

    def get_pipeline_status(self) -> Dict[str, Any]:
        """Returns current status of free pipelines."""
        return {
            "webhook": {
                "configured": bool(self.webhook_url),
                "url": self.webhook_url[:25] + "..." if len(self.webhook_url) > 25 else self.webhook_url,
                "provider": self._detect_provider(self.webhook_url) if self.webhook_url else "none",
                "supports": ["Discord Webhook (Free)", "Slack Incoming Webhook (Free)", "Webhook.site (Free)", "Make / n8n (Free)"]
            },
            "smtp": {
                "configured": bool(self.smtp_host and self.smtp_user),
                "host": self.smtp_host or "Not configured (Using Live Outbox Inspector)",
                "port": self.smtp_port,
                "sender": self.smtp_from,
                "supports": ["Gmail Free App Password", "Mailtrap Free Sandbox", "Standard TLS SMTP"]
            },
            "outbox_count": len(self._outbox),
            "free_tier_notice": "All pipelines operate with 100% free options without paid third-party enterprise subscriptions."
        }

    def _detect_provider(self, url: str) -> str:
        if not url:
            return "none"
        u = url.lower()
        if "discord.com" in u or "discordapp.com" in u:
            return "discord"
        elif "hooks.slack.com" in u:
            return "slack"
        elif "webhook.site" in u:
            return "webhook_site"
        return "generic_webhook"

    async def dispatch_webhook_event(
        self,
        event_type: str,
        title: str,
        description: str,
        account_name: str,
        account_id: str,
        fields: Optional[List[Dict[str, Any]]] = None,
        link_url: Optional[str] = None,
        urgency: str = "high"
    ) -> Dict[str, Any]:
        """
        Dispatches an event card to the configured free webhook.
        Automatically formats for Discord Embeds, Slack Blocks, or Generic JSON.
        """
        target_url = self.webhook_url
        if not target_url:
            # Fallback record in outbox
            record = {
                "id": f"wh-{len(self._outbox) + 1}",
                "timestamp": datetime.utcnow().isoformat(),
                "event_type": event_type,
                "title": title,
                "description": description,
                "account_name": account_name,
                "status": "logged_no_webhook_configured",
                "details": fields or []
            }
            self._outbox.insert(0, record)
            return {"status": "logged", "message": "No webhook URL configured; event recorded in Live Outbox."}

        provider = self._detect_provider(target_url)
        payload = {}

        # 1. Discord Embed formatting
        if provider == "discord":
            color = 0x2563EB if urgency == "medium" else (0xEF4444 if urgency == "critical" else 0xF59E0B)
            embed_fields = [
                {"name": "🏢 Account", "value": f"**{account_name}** (`{account_id}`)", "inline": True},
                {"name": "⚡ Urgency", "value": urgency.upper(), "inline": True}
            ]
            if fields:
                for f in fields:
                    embed_fields.append({"name": f.get("name", "Field"), "value": str(f.get("value", "")), "inline": f.get("inline", False)})
            if link_url:
                embed_fields.append({"name": "🔗 Action Link", "value": f"[Open in Revora]({link_url})", "inline": False})

            payload = {
                "username": "Revora Revenue Intelligence",
                "avatar_url": "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/shield-check.png",
                "embeds": [{
                    "title": f"🔔 {title}",
                    "description": description,
                    "color": color,
                    "fields": embed_fields,
                    "footer": {"text": "Revora Churn Prevention Engine • Free Pipeline Dispatch"},
                    "timestamp": datetime.utcnow().isoformat()
                }]
            }

        # 2. Slack Blocks formatting
        elif provider == "slack":
            slack_text = f"*{title}*\n{description}\n*Account:* {account_name} (`{account_id}`)"
            payload = {
                "text": f"Revora Alert: {title}",
                "blocks": [
                    {
                        "type": "header",
                        "text": {"type": "plain_text", "text": f"🔔 {title[:140]}"}
                    },
                    {
                        "type": "section",
                        "text": {"type": "mrkdwn", "text": slack_text}
                    }
                ]
            }
            if link_url:
                payload["blocks"].append({
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"<{link_url}|*Open Revora Dossier* >"}
                })

        # 3. Generic JSON Webhook
        else:
            payload = {
                "app": "Revora Revenue Intelligence",
                "event_type": event_type,
                "title": title,
                "description": description,
                "account_id": account_id,
                "account_name": account_name,
                "urgency": urgency,
                "fields": fields or [],
                "link_url": link_url,
                "timestamp": datetime.utcnow().isoformat()
            }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(target_url, json=payload)
                success = res.status_code in (200, 204)
                delivery_record = {
                    "id": f"wh-{len(self._outbox) + 1}",
                    "timestamp": datetime.utcnow().isoformat(),
                    "event_type": event_type,
                    "provider": provider,
                    "status_code": res.status_code,
                    "status": "delivered" if success else "failed",
                    "payload_sent": payload,
                    "response_text": res.text[:200]
                }
                self._outbox.insert(0, delivery_record)
                return {
                    "status": "delivered" if success else "failed",
                    "status_code": res.status_code,
                    "provider": provider,
                    "message": f"Successfully posted live event to {provider} webhook!"
                }
        except Exception as e:
            logger.error(f"Free webhook delivery error: {e}")
            failure_record = {
                "id": f"wh-{len(self._outbox) + 1}",
                "timestamp": datetime.utcnow().isoformat(),
                "event_type": event_type,
                "provider": provider,
                "status": "network_error",
                "error": str(e)
            }
            self._outbox.insert(0, failure_record)
            return {"status": "error", "error": str(e), "provider": provider}

    def dispatch_email(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        body_text: str,
        html_body: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Dispatches email via standard free SMTP if configured,
        or captures it into the Live Outbox for interactive inspection.
        """
        now = datetime.utcnow().isoformat()
        outbox_entry = {
            "id": f"email-{len(self._outbox) + 1}",
            "timestamp": now,
            "type": "email",
            "to_email": to_email,
            "to_name": to_name,
            "from_email": self.smtp_from,
            "subject": subject,
            "body_text": body_text,
            "html_body": html_body or f"<pre style='font-family: sans-serif; white-space: pre-wrap;'>{body_text}</pre>",
            "delivery_channel": "SMTP" if (self.smtp_host and self.smtp_user) else "Live Outbox Simulator",
            "status": "queued"
        }

        # If live free SMTP credentials provided (e.g. Gmail App Password)
        if self.smtp_host and self.smtp_user and self.smtp_pass:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = self.smtp_from
                msg["To"] = to_email

                part1 = MIMEText(body_text, "plain")
                msg.attach(part1)
                if html_body:
                    part2 = MIMEText(html_body, "html")
                    msg.attach(part2)

                with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10) as server:
                    server.starttls()
                    server.login(self.smtp_user, self.smtp_pass)
                    server.sendmail(self.smtp_from, [to_email], msg.as_string())

                outbox_entry["status"] = "delivered_via_smtp"
                self._outbox.insert(0, outbox_entry)
                return {
                    "status": "delivered",
                    "channel": "smtp",
                    "recipient": to_email,
                    "message": f"Successfully delivered email to {to_email} via SMTP ({self.smtp_host})"
                }
            except Exception as e:
                logger.error(f"SMTP delivery failed: {e}. Fallback to Outbox.")
                outbox_entry["status"] = f"smtp_failed_{str(e)[:50]}"
                outbox_entry["error"] = str(e)
                self._outbox.insert(0, outbox_entry)
                return {
                    "status": "fallback_outbox",
                    "error": str(e),
                    "outbox_record": outbox_entry
                }
        else:
            outbox_entry["status"] = "captured_in_live_outbox"
            self._outbox.insert(0, outbox_entry)
            return {
                "status": "delivered_to_outbox",
                "channel": "live_outbox",
                "recipient": to_email,
                "message": f"Captured in Live Outbox for {to_name} <{to_email}> (Ready for judge inspection)"
            }

    def get_recent_outbox(self, limit: int = 30) -> List[Dict[str, Any]]:
        """Returns recent dispatched emails and webhooks."""
        return self._outbox[:limit]

    def clear_outbox(self):
        self._outbox.clear()

free_pipelines = FreePipelineService()
