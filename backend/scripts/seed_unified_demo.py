#!/usr/bin/env python
"""
Repeatable, deterministic unified demo data seeding script for SignalBridge AI.

Usage:
    python scripts/seed_unified_demo.py [--skip-live-fetch]

Features:
- Fetches real companies, contacts, and deals from HubSpot CRM API.
- Generates deterministic simulated records for Email, Calendar, Slack, Telemetry, and Support.
- Associates every record with the canonical internal account ID.
- Idempotently upserts records into MongoDB and in-memory caches (rerunning produces zero duplicates).
- Computes deterministic risk scores using the multi-channel Risk Engine.
"""

import sys
import argparse
from pathlib import Path

# Add backend root to sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.services.unified_demo_system import unified_demo_system

def main():
    parser = argparse.ArgumentParser(description="Seed unified demo data for SignalBridge AI")
    parser.add_argument(
        "--skip-live-fetch",
        action="store_true",
        help="Skip fetching live objects from HubSpot API and use offline deterministic definitions"
    )
    args = parser.parse_args()

    print("=" * 70)
    print("🚀 SIGNALBRIDGE AI — UNIFIED DEMO DATA SEEDING")
    print("=" * 70)
    print(f"Live HubSpot Fetch: {'DISABLED' if args.skip_live_fetch else 'ENABLED'}")

    res = unified_demo_system.seed_all(execute_hubspot_live_fetch=not args.skip_live_fetch)

    print("\n✅ Seed Execution Complete!")
    print(f"Status:            {res.get('status')}")
    print(f"Accounts Seeded:   {res.get('accounts_seeded')}")
    print(f"Contacts Seeded:   {res.get('contacts_seeded')}")
    print(f"Signals Seeded:    {res.get('signals_seeded')}")
    print(f"Live HubSpot Sync: {res.get('live_hubspot_integrated')}")
    print(f"Channels:          {', '.join(res.get('simulated_channels', []))}")
    print(f"Duration:          {res.get('duration_ms')} ms")
    print("=" * 70)

if __name__ == "__main__":
    main()
