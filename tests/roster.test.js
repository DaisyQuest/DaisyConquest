/* tests/roster.test.js — sanity checks on the unit/promotion data tables.
 *
 * Static data is tempting to skip-test, but typos here cause silent
 * bugs in the recruit screen and broken promotion flows that wouldn't
 * surface until the player tried them. These run in milliseconds. */

import { describe, it, expect } from "vitest";
import { UNITS, PROMOTIONS, unitsByFaction } from "../src/data/units.js";
import { FACTIONS, FACTION_LIST } from "../src/data/factions.js";

describe("UNITS table", () => {
  it("every unit has the required schema fields", () => {
    for (const [id, u] of Object.entries(UNITS)) {
      expect(u.id, `${id}.id mismatch`).toBe(id);
      expect(typeof u.name).toBe("string");
      expect(typeof u.icon).toBe("string");
      expect([1, 2, 3, 4]).toContain(u.tier);
      expect(["vanguard", "skirmisher", "support", "siege"]).toContain(u.role);
      expect(u.hp).toBeGreaterThan(0);
      expect(u.atk).toBeGreaterThanOrEqual(0);
      expect(u.def).toBeGreaterThanOrEqual(0);
      expect(u.spd).toBeGreaterThan(0);
      expect(u.range).toBeGreaterThanOrEqual(1);
      expect(u.cost).toBeGreaterThanOrEqual(0);
      expect(u.upkeep).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(u.traits)).toBe(true);
      expect(typeof u.faction).toBe("string");
      expect(typeof u.desc).toBe("string");
    }
  });

  it("every unit's faction exists in FACTIONS", () => {
    for (const u of Object.values(UNITS)) {
      expect(FACTIONS[u.faction], `unknown faction "${u.faction}" on ${u.id}`).toBeDefined();
    }
  });

  it("each playable faction has at least 14 units", () => {
    for (const fid of FACTION_LIST) {
      const roster = unitsByFaction(fid);
      expect(roster.length, `${fid} roster too small`).toBeGreaterThanOrEqual(14);
    }
  });

  it("each playable faction has units across tiers 1-4", () => {
    for (const fid of FACTION_LIST) {
      const roster = unitsByFaction(fid);
      const tiers = new Set(roster.map((u) => u.tier));
      expect(tiers.has(1), `${fid} missing T1`).toBe(true);
      expect(tiers.has(2), `${fid} missing T2`).toBe(true);
      expect(tiers.has(3), `${fid} missing T3`).toBe(true);
      expect(tiers.has(4), `${fid} missing T4 elite`).toBe(true);
    }
  });

  it("each playable faction covers all four roles", () => {
    for (const fid of FACTION_LIST) {
      const roster = unitsByFaction(fid);
      const roles = new Set(roster.map((u) => u.role));
      for (const r of ["vanguard", "skirmisher", "support", "siege"]) {
        expect(roles.has(r), `${fid} missing role ${r}`).toBe(true);
      }
    }
  });

  it("starter units listed in FACTIONS[fid].units exist in UNITS", () => {
    for (const fid of FACTION_LIST) {
      for (const u of FACTIONS[fid].units) {
        expect(UNITS[u], `${fid}.units references unknown ${u}`).toBeDefined();
      }
    }
  });
});

describe("PROMOTIONS graph", () => {
  it("every source unit exists in UNITS", () => {
    for (const sourceId of Object.keys(PROMOTIONS)) {
      expect(UNITS[sourceId], `PROMOTIONS source ${sourceId} not in UNITS`).toBeDefined();
    }
  });

  it("every promotion target exists in UNITS and is a higher tier", () => {
    for (const [sourceId, branches] of Object.entries(PROMOTIONS)) {
      const source = UNITS[sourceId];
      for (const targetId of branches) {
        const target = UNITS[targetId];
        expect(target, `PROMOTIONS target ${targetId} (from ${sourceId}) not in UNITS`).toBeDefined();
        expect(
          target.tier,
          `${sourceId} (T${source.tier}) → ${targetId} (T${target.tier}) is not a tier-up`
        ).toBeGreaterThan(source.tier);
      }
    }
  });

  it("promotion targets stay within the same faction", () => {
    for (const [sourceId, branches] of Object.entries(PROMOTIONS)) {
      const source = UNITS[sourceId];
      for (const targetId of branches) {
        const target = UNITS[targetId];
        expect(
          target.faction,
          `${sourceId} → ${targetId} crosses factions (${source.faction} → ${target.faction})`
        ).toBe(source.faction);
      }
    }
  });

  it("T4 units do not promote further (dead end)", () => {
    for (const u of Object.values(UNITS)) {
      if (u.tier === 4) {
        expect(PROMOTIONS[u.id]).toBeUndefined();
      }
    }
  });

  it("every playable faction has at least one T1→T2→T3→T4 reachable path", () => {
    // Walk forward from any T1 of the faction; verify a T4 is reachable.
    for (const fid of FACTION_LIST) {
      const roster = unitsByFaction(fid);
      const t1 = roster.filter((u) => u.tier === 1).map((u) => u.id);
      const reach = (start) => {
        const seen = new Set([start]);
        const queue = [start];
        while (queue.length) {
          const cur = queue.shift();
          for (const next of PROMOTIONS[cur] || []) {
            if (!seen.has(next)) {
              seen.add(next);
              queue.push(next);
            }
          }
        }
        return [...seen]
          .map((id) => UNITS[id])
          .some((u) => u.tier === 4);
      };
      const reaches = t1.some(reach);
      expect(reaches, `${fid} has no T1→…→T4 promotion path`).toBe(true);
    }
  });
});
