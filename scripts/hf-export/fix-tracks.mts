/**
 * Removing a dead animation track without baking it FIRST silently re-poses the
 * model. That is not a theory: every dead track in these three machines holds a
 * constant that is NOT the node's rest transform --
 *
 *   tractor / cultivator  pivothitchLowerLeft   z = -16.617 deg, rest 0
 *                         pivothitchLowerRight  z = +16.617 deg, rest 0
 *                         pivothitchTopLink     z = -10.885 deg, rest 0
 *                         pivotdepthAdjust      z = -13.749 deg, rest 0
 *   seeder                pivotrowUnit01..04    z =  -3.151 deg, rest 0
 *                         pivotdepthAdjust      z =  -6.876 deg, rest 0
 *
 * -- so `removeDeadTracks` on its own drops the seeder's four row units back by
 * 3.15 deg and lifts the whole machine 20.6 mm off the ground it had just been
 * seated on. The track is not payload; it is the pose, stored in the wrong place.
 *
 * So: bake the constant into the node, THEN drop the track. The result is
 * byte-for-byte the same silhouette with fewer tracks, which is what "remove a
 * track that does nothing" was supposed to mean.
 *
 * One case is refused rather than guessed: if the same node carries a dead track
 * in two clips with two DIFFERENT constants, there is no single rest pose that
 * satisfies both, and those tracks are left in place and reported.
 */
import { THREE } from './lib.mjs';

export interface BakedTrack {
  node: string;
  property: string;
  clips: string[];
  constant: number[];
  restBefore: number[];
  restAfter: number[];
  alsoAnimatedLiveIn: string[];
}

export interface DeadTrackReport {
  baked: BakedTrack[];
  refused: { node: string; property: string; reason: string; constants: number[][] }[];
  removedByClip: { clip: string; removed: string[]; tracksBefore: number; tracksAfter: number }[];
}

const isDead = (track: THREE.KeyframeTrack): boolean => {
  const values = track.values as unknown as ArrayLike<number>;
  const stride = values.length / track.times.length;
  for (let i = stride; i < values.length; i += 1) {
    if (Math.abs(values[i] - values[i % stride]) > 1e-6) return false;
  }
  return true;
};

const constantOf = (track: THREE.KeyframeTrack): number[] => {
  const values = track.values as unknown as ArrayLike<number>;
  const stride = values.length / track.times.length;
  return Array.from({ length: stride }, (_, i) => values[i]);
};

/**
 * Bake every constant-valued track into its node's rest transform, then remove
 * those tracks from every clip. Returns exactly what moved and what was dropped.
 */
export function bakeAndRemoveDeadTracks(root: THREE.Object3D, clips: readonly THREE.AnimationClip[]): DeadTrackReport {
  const dead = new Map<string, { node: string; property: string; constant: number[]; clips: string[]; conflict: number[][] }>();
  const live = new Map<string, string[]>();

  for (const clip of clips) {
    for (const track of clip.tracks) {
      const [node, property] = track.name.split('.');
      const key = `${node}.${property}`;
      if (!isDead(track)) {
        const list = live.get(key) ?? [];
        list.push(clip.name);
        live.set(key, list);
        continue;
      }
      const constant = constantOf(track);
      const seen = dead.get(key);
      if (!seen) { dead.set(key, { node, property, constant, clips: [clip.name], conflict: [constant] }); continue; }
      seen.clips.push(clip.name);
      seen.conflict.push(constant);
    }
  }

  const report: DeadTrackReport = { baked: [], refused: [], removedByClip: [] };
  const drop = new Set<string>();

  for (const [key, entry] of dead) {
    const differs = entry.conflict.some((c) => c.some((v, i) => Math.abs(v - entry.constant[i]) > 1e-6));
    if (differs) {
      report.refused.push({ node: entry.node, property: entry.property, reason: 'the same node holds two different constants in two clips, so there is no one rest pose that keeps both; left in place', constants: entry.conflict });
      continue;
    }
    const target = root.getObjectByName(entry.node);
    if (!target) {
      report.refused.push({ node: entry.node, property: entry.property, reason: 'the node this track drives is not in the file; left in place', constants: entry.conflict });
      continue;
    }
    const read = (): number[] => {
      if (entry.property === 'quaternion') return target.quaternion.toArray() as number[];
      if (entry.property === 'position') return target.position.toArray();
      if (entry.property === 'scale') return target.scale.toArray();
      return [];
    };
    const before = read();
    if (entry.property === 'quaternion') target.quaternion.fromArray(entry.constant).normalize();
    else if (entry.property === 'position') target.position.fromArray(entry.constant);
    else if (entry.property === 'scale') target.scale.fromArray(entry.constant);
    else {
      report.refused.push({ node: entry.node, property: entry.property, reason: 'not a transform track; baking it into a node is not defined', constants: entry.conflict });
      continue;
    }
    report.baked.push({
      node: entry.node, property: entry.property, clips: entry.clips,
      constant: entry.constant.map((v) => Math.round(v * 1e6) / 1e6),
      restBefore: before.map((v) => Math.round(v * 1e6) / 1e6),
      restAfter: read().map((v) => Math.round(v * 1e6) / 1e6),
      alsoAnimatedLiveIn: live.get(key) ?? [],
    });
    drop.add(key);
  }

  for (const clip of clips) {
    const tracksBefore = clip.tracks.length;
    const removed = clip.tracks.filter((t) => drop.has(t.name)).map((t) => t.name);
    if (removed.length === 0) continue;
    clip.tracks = clip.tracks.filter((t) => !drop.has(t.name));
    report.removedByClip.push({ clip: clip.name, removed, tracksBefore, tracksAfter: clip.tracks.length });
  }
  root.updateMatrixWorld(true);
  return report;
}
