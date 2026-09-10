"""Comprehensive Part 3 End-to-End Test and Verification Script."""
import asyncio
import os
import json
import sys
import httpx
from backend.main import create_app
from backend.core.config import Settings
from backend.geospatial.utils import haversine
from backend.schemas.marine import Location


async def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    print("==================================================")
    print("ORCA — PART 3 COMPREHENSIVE VERIFICATION")
    print("==================================================")

    config = Settings(demo_mode=True)
    app = create_app(config)

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # 1. Health check
            r = await client.get("/health")
            assert r.status_code == 200
            print("✓ 1. System Health Check: OK")

            # 2. Safety Analysis
            print("\n--- 2. Deterministic Safety Risk Analysis ---")
            safety_payload = {
                "location": {"lat": 10.767, "lon": 79.872},
                "vessel_profile": "small_fishing_boat"
            }
            r = await client.post("/api/v1/safety/analyze", json=safety_payload)
            assert r.status_code == 200, f"Safety analyze failed: {r.text}"
            safety_data = r.json()
            risk = safety_data["risk"]
            assert risk['level'] != 'UNKNOWN'
            print(f"✓ Location: (10.767, 79.872) | Vessel: small_fishing_boat")
            print(f"  Risk Score: {risk['score']}/100 | Risk Level: {risk['level']} | Confidence: {risk['confidence']}")
            print(f"  Factors evaluated: {len(risk['factors'])}")
            for f in risk["factors"]:
                print(f"   - {f['factor']}: {f['contribution']} pts ({f['finding']})")
            if risk["official_overrides"]:
                print(f"  Official Overrides: {len(risk['official_overrides'])}")

            # 3. Safe PFZ Ranking
            print("\n--- 3. Safe PFZ Ranking (Multi-Factor & Safety Gated) ---")
            pfz_payload = {
                "origin": {"lat": 10.767, "lon": 79.872},
                "limit": 5,
                "vessel_profile": "small_fishing_boat"
            }
            r = await client.post("/api/v1/pfz/rank-safe", json=pfz_payload)
            assert r.status_code == 200, f"PFZ rank failed: {r.text}"
            pfz_data = r.json()
            safe_cands = pfz_data["ranked_candidates"]
            excl_cands = pfz_data["excluded_candidates"]
            assert safe_cands, 'Recorded replay must produce a safety-gated PFZ candidate'
            print(f"✓ Safe candidates: {len(safe_cands)} | Excluded candidates: {len(excl_cands)}")
            for c in safe_cands:
                print(f"  #{c['rank']} {c['name']} (ID: {c['pfz_id']}): SuitabilityScore={c['ranking_score']}, Dist={c['distance_km']}km, RiskScore={c['risk_score']} ({c['risk_level']})")
            for c in excl_cands:
                print(f"  [EXCLUDED] {c['name']}: {c['exclusion_reasons']}")

            # 4. A* Safe Marine Routing
            print("\n--- 4. Deterministic A* Safe Marine Routing ---")
            route_payload = {
                "origin": {"lat": 10.767, "lon": 79.872},
                "destination": {"lat": 10.87, "lon": 80.1},
                "vessel_type": "small_fishing_boat",
                "optimization_preference": "safety_first"
            }
            r = await client.post("/api/v1/routes/safe", json=route_payload)
            assert r.status_code == 200, f"Route safe failed: {r.text}"
            route_res = r.json()
            print(f"✓ Route ID: {route_res['route_id']}")
            print(f"  Total Distance: {route_res['total_distance_km']} km")
            print(f"  Est. Duration: {route_res['estimated_duration_hours']} hours")
            print(f"  Safety Score: {route_res['safety_score']}/100 | Risk Level: {route_res['overall_risk_level']}")
            print(f"  Waypoints: {len(route_res['coordinates'])} | Calculation Time: {route_res['calculation_time_ms']} ms")
            print(f"  Avoided Hazards: {route_res['avoided_hazards']}")

            # 5. Route Comparison (Shortest vs Safe)
            print("\n--- 5. Route Comparison (Shortest vs. Safe Recommended) ---")
            r = await client.post("/api/v1/routes/compare", json=route_payload)
            assert r.status_code == 200, f"Route compare failed: {r.text}"
            comp = r.json()
            print(f"✓ Shortest Route Distance: {comp['shortest_route']['total_distance_km']} km (Risk: {comp['shortest_route']['overall_risk_score']})")
            print(f"✓ Safe Route Distance: {comp['safe_route']['total_distance_km']} km (Risk: {comp['safe_route']['overall_risk_score']})")
            print(f"  Detour: +{comp['detour_distance_km']} km ({comp['detour_percentage']}%) | Extra Time: +{int(comp['extra_duration_hours']*60)} mins")
            print(f"  Risk Reduction: {comp['risk_reduction_score']} points ({comp['risk_reduction_percentage']}%)")
            print(f"  Explanation: {comp['trade_off_explanation']}")

            # 6. Geofencing & Trajectory Prediction
            print("\n--- 6. Geofencing Proximity & Dead Reckoning Trajectory ---")
            gf_payload = {
                "position": {"lat": 10.79, "lon": 79.95},
                "heading_degrees": 0.0,
                "speed_knots": 12.0
            }
            r = await client.post("/api/v1/geofence/check", json=gf_payload)
            assert r.status_code == 200, f"Geofence check failed: {r.text}"
            gf_res = r.json()
            print(f"✓ Status: {gf_res['status']} | Boundaries: {len(gf_res['boundaries'])}")
            for b in gf_res["boundaries"]:
                print(f"   - {b['zone_name']}: dist={b['distance_km']}km, bearing={b['bearing_degrees']}°, breach_min={b['projected_breach_minutes']}")
            print(f"  Warnings: {len(gf_res['warnings'])}")
            for w in gf_res["warnings"]:
                print(f"   * [{w['level']}] {w['message']} (Course correction: {w['recommended_heading_degrees']}°)")

            # 7. Vessel Simulation & Dynamic Rerouting
            print("\n--- 7. Vessel Simulation & Dynamic Rerouting ---")
            sim_start_payload = {
                "origin": {"lat": 10.767, "lon": 79.872},
                "destination": {"lat": 10.87, "lon": 80.1},
                "vessel_id": "vessel-orca-01",
                "speed_knots": 14.0,
                "step_interval_minutes": 5.0,
                "simulate_hazard_emergence": True
            }
            r = await client.post("/api/v1/simulation/start", json=sim_start_payload)
            assert r.status_code == 200, f"Simulation start failed: {r.text}"
            sim = r.json()
            sim_id = sim["simulation_id"]
            print(f"✓ Simulation started: {sim_id} | Initial Dist: {sim['remaining_distance_km']} km")

            previous_position = None
            for step_idx in range(1, 5):
                r = await client.post(f"/api/v1/simulation/{sim_id}/step")
                assert r.status_code == 200
                step_res = r.json()
                st = step_res["state"]
                assert all('action' in action for action in step_res['map_actions'])
                if step_idx == 4 and previous_position:
                    moved_km = haversine(Location(**previous_position), Location(**st['current_position']))
                    assert moved_km <= 2.3, f'Reroute caused an impossible {moved_km:.2f} km position jump'
                previous_position = st['current_position']
                print(f"  Step {step_idx}: Pos=({st['current_position']['lat']}, {st['current_position']['lon']}) | Prog={st['progress_percentage']}% | Rem={st['remaining_distance_km']}km | NeedsReroute={st['route_needs_recalculation']}")
                for act in step_res["map_actions"]:
                    print(f"   MapAction: {act['action']} - {act.get('title') or act.get('id')}")

            r = await client.post(f"/api/v1/simulation/{sim_id}/stop")
            assert r.status_code == 200
            print("✓ Simulation stopped cleanly.")

            # 8. Agent Chat Integration
            print("\n--- 8. Multi-Agent Conversational Integration ---")
            chat_queries = [
                ("Is it safe to go fishing near Nagapattinam tomorrow morning?", 'marine_safety'),
                ("Where should I fish tomorrow morning near Nagapattinam?", 'nearest_safe_pfz'),
                ("Are we heading near any restricted zone?", 'geofence_question'),
            ]
            for q, expected_intent in chat_queries:
                r = await client.post("/api/v1/chat", json={
                    "message": q,
                    "location": {"lat": 10.767, "lon": 79.872}
                })
                assert r.status_code == 200, f"Chat query failed: {r.text}"
                chat_res = r.json()
                assert chat_res['intent'] == expected_intent
                if expected_intent == 'marine_safety':
                    assert chat_res.get('risk') and chat_res['risk']['risk']['level'] != 'UNKNOWN'
                elif expected_intent == 'nearest_safe_pfz':
                    assert chat_res.get('recommended_pfz')
                else:
                    assert chat_res.get('geofence')
                    assert 'boundary warning' in chat_res['answer'].lower()
                print(f"✓ Query: '{q}'")
                print(f"  Intent: {chat_res['intent']} | Confidence: {chat_res['confidence']}")
                print(f"  Answer: {chat_res['answer'][:110]}...")
                print(f"  Risk: {bool(chat_res.get('risk'))} | Route: {bool(chat_res.get('route'))} | Geofence: {bool(chat_res.get('geofence'))}")
                print(f"  Map Actions count: {len(chat_res['map_actions'])}")
                for act in chat_res["map_actions"]:
                    print(f"   * MapAction: {act['action']} ({act.get('title') or act.get('id')})")

    print("\n==================================================")
    print("ALL PART 3 VERIFICATIONS PASSED SUCCESSFULLY!")
    print("==================================================")


if __name__ == "__main__":
    asyncio.run(main())
