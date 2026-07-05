import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Polyline as SvgPolyline } from 'react-native-svg';
import { distanceMetres, LatLon, metresToYards } from '../logic/gps';
import {
  BBox,
  bearingDeg,
  esriImageUrlMerc,
  fetchHoles,
  HoleGeo,
  nearestHoleIndex,
  squareBBoxM,
  project,
  unproject,
  fetchGreens,
  pickGreenForHole,
  fmbMetres,
  fmbFromCenter,
  GreenPoly,
} from '../logic/flyover';
import { colors, radius } from '../theme';
import { Round } from '../types';

interface Props {
  round: Round;
  onBack?: () => void;
}

type Units = 'm' | 'yd';
type Handle = 's' | 'a' | 'e';

const mid = (a: LatLon, b: LatLon): LatLon => ({
  lat: (a.lat + b.lat) / 2,
  lon: (a.lon + b.lon) / 2,
});

export default function GpsScreen({ round, onBack }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('Finding the course…');
  const [holes, setHoles] = useState<HoleGeo[]>([]);
  const [greens, setGreens] = useState<GreenPoly[] | null>(null);
  useEffect(() => {
    if (greens || !holes || holes.length === 0) return;
    let glat = 0, glon = 0, gn = 0;
    for (const h of holes) { if (h.green) { glat += h.green.lat; glon += h.green.lon; gn++; } }
    if (gn === 0) return;
    const gcenter = { lat: glat / gn, lon: glon / gn };
    let grad = 0;
    for (const h of holes) { if (h.green) { const gd = distanceMetres(gcenter, h.green); if (gd > grad) grad = gd; } }
    const gradius = Math.min(2500, Math.round(grad) + 400);
    let galive = true;
    fetchGreens(gcenter, gradius).then((gg) => { if (galive) setGreens(gg); }).catch(() => { if (galive) setGreens([]); });
    return () => { galive = false; };
  }, [holes, greens]);
  const [idx, setIdx] = useState(0);
  const [pos, setPos] = useState<LatLon | null>(null);
  const [fbPos, setFbPos] = useState<LatLon | null>(null);
  const [green, setGreen] = useState<LatLon | null>(null);
  useEffect(() => {
    if (status !== 'error') return;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 1 },
          (loc) => setFbPos({ lat: loc.coords.latitude, lon: loc.coords.longitude }),
        );
      } catch {}
    })();
    return () => { if (sub) sub.remove(); };
  }, [status]);
  const [startPt, setStartPt] = useState<LatLon | null>(null);
  const [aim, setAim] = useState<LatLon | null>(null);
  const [endPt, setEndPt] = useState<LatLon | null>(null);
  const [units, setUnits] = useState<Units>('m');
  const [imgError, setImgError] = useState(false);
  const win = Dimensions.get('window');
  const [layout, setLayout] = useState({ w: win.width, h: win.height });

  // Live refs the touch handlers read (avoids stale closures).
  const geoRef = useRef<{
    bbox: BBox | null;
    w: number;
    h: number;
    S: number;
    bearing: number;
    panTx: number;
    panTy: number;
    scale: number;
  }>({
    bbox: null,
    w: win.width,
    h: win.height,
    S: 0,
    bearing: 0,
    panTx: 0,
    panTy: 0,
    scale: 1,
  });
  // Camera anchor, frozen so the satellite image is not refetched on every
  // GPS tick. Re-anchors on hole change or when you move ~30 m.
  const camRef = useRef<{ idx: number; anchor: LatLon } | null>(null);
  const handlesRef = useRef<{ [k in Handle]: { x: number; y: number } }>({
    s: { x: 0, y: 0 },
    a: { x: 0, y: 0 },
    e: { x: 0, y: 0 },
  });
  const dragRef = useRef<Handle | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pinchScale, setPinchScale] = useState(1);
  const pinchRef = useRef<{ dist: number } | null>(null);
  const [basePan, setBasePan] = useState({ x: 0, y: 0 });
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const panRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setZoom(1);
    setPinchScale(1);
    setBasePan({ x: 0, y: 0 });
    setPanX(0);
    setPanY(0);
  }, [idx]);

  const resetLine = (hole: HoleGeo) => {
    camRef.current = null;
    setStartPt(hole.tee);
    setAim(mid(hole.tee, hole.green));
    setEndPt(hole.green);
  };

  const start = async () => {
    setStatus('loading');
    setMessage('Finding the course…');
    const { status: perm } = await Location.requestForegroundPermissionsAsync();
    let here: LatLon | null = null;
    if (perm === 'granted') {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        here = { lat: loc.coords.latitude, lon: loc.coords.longitude };
        setPos(here);
      } catch {
        /* fall through */
      }
    }
    if (!here) {
      setStatus('error');
      setMessage('Location permission is needed to find your course.');
      return;
    }
    try {
      let sLat = here.lat;
      let sLon = here.lon;
      const cname = round && round.courseName ? round.courseName : '';
      if (cname) {
        try {
          const g = await fetch(
            'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(cname),
            { headers: { Accept: 'application/json', 'User-Agent': 'R2TC-Tour/1.0 (https://r2tcgolfclub.com)' } },
          ).then((r) => r.json());
          if (g && g[0] && g[0].lat) { sLat = parseFloat(g[0].lat); sLon = parseFloat(g[0].lon); }
        } catch {}
      }
      const list = await fetchHoles(sLat, sLon);
      if (list.length === 0) {
        setStatus('error');
        setMessage(
          "No mapped holes nearby. This course isn't in OpenStreetMap yet — " +
            'the flyover will work once its holes are mapped.',
        );
        return;
      }
      setHoles(list);
      const n = nearestHoleIndex(here, list);
      setIdx(n);
      resetLine(list[n]);
      setStatus('ready');
    } catch {
      setStatus('error');
      setMessage('Could not load the course — check your internet.');
    }
  };

  useEffect(() => {
    start();
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 4 },
          (loc) =>
            setPos({ lat: loc.coords.latitude, lon: loc.coords.longitude }),
        );
      } catch {
        /* one-shot still works */
      }
    })();
    return () => sub?.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goHole = (next: number) => {
    const n = (next + holes.length) % holes.length;
    setIdx(n);
    resetLine(holes[n]);
    setImgError(false);
  };

  const fmt = (m: number) =>
    units === 'm' ? `${Math.round(m)}` : `${Math.round(metresToYards(m))}`;

  // ----- touch handlers (drag the start / aim / end handles) -----
  // The map canvas is a square of side S rotated by -bearing around the
  // screen centre; convert screen touch points into canvas space first.
  const screenToCanvas = (sx: number, sy: number) => {
    const g = geoRef.current;
    const b = (g.bearing * Math.PI) / 180;
    const k = g.scale || 1;
    const dx = (sx - g.panTx - g.w / 2) / k;
    const dy = (sy - g.panTy - g.h / 2) / k;
    return {
      x: g.S / 2 + dx * Math.cos(b) - dy * Math.sin(b),
      y: g.S / 2 + dx * Math.sin(b) + dy * Math.cos(b),
    };
  };
  const pickHandle = (x: number, y: number): Handle | null => {
    const H = handlesRef.current;
    const order: [Handle, number][] = [
      ['a', Math.hypot(H.a.x - x, H.a.y - y)],
      ['s', Math.hypot(H.s.x - x, H.s.y - y)],
      ['e', Math.hypot(H.e.x - x, H.e.y - y)],
    ];
    order.sort((m, n) => m[1] - n[1]);
    return order[0][1] < 44 / (geoRef.current.scale || 1) ? order[0][0] : null;
  };

  const touchDist = (touches: any[]) => {
    const a = touches[0];
    const b = touches[1];
    const dx = a.pageX - b.pageX;
    const dy = a.pageY - b.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  const onGrant = (e: any) => {
    const touches = e.nativeEvent.touches || [];
    if (touches.length >= 2) {
      pinchRef.current = { dist: touchDist(touches) };
      dragRef.current = null;
      panRef.current = null;
      return;
    }
    const { locationX: x, locationY: y, pageX, pageY } = e.nativeEvent;
    const c = screenToCanvas(x, y);
    const hit = pickHandle(c.x, c.y);
    if (hit) {
      dragRef.current = hit;
    } else {
      // empty ground → pan the map
      panRef.current = { x: pageX, y: pageY };
    }
  };
  const onMove = (e: any) => {
    const touches = e.nativeEvent.touches || [];
    if (touches.length >= 2) {
      dragRef.current = null;
      panRef.current = null;
      if (!pinchRef.current) pinchRef.current = { dist: touchDist(touches) };
      let s = touchDist(touches) / (pinchRef.current.dist || 1);
      s = Math.max(0.3, Math.min(5, s));
      setPinchScale(s);
      return;
    }
    if (panRef.current) {
      setPanX(e.nativeEvent.pageX - panRef.current.x);
      setPanY(e.nativeEvent.pageY - panRef.current.y);
      return;
    }
    if (!dragRef.current) return;
    const { locationX: x, locationY: y } = e.nativeEvent;
    const g = geoRef.current;
    if (!g.bbox || !g.S) return;
    const c = screenToCanvas(x, y);
    const ll = unproject(c.x, c.y, g.bbox, g.S, g.S);
    if (dragRef.current === 's') setStartPt(ll);
    else if (dragRef.current === 'e') setEndPt(ll);
    else setAim(ll);
  };
  const onRelease = () => {
    dragRef.current = null;
    if (pinchRef.current) {
      setZoom((z) => Math.max(0.55, Math.min(4, z * pinchScale)));
      pinchRef.current = null;
    } else if (panRef.current) {
      // Pan is a pure screen-space transform - no image refetch.
      setBasePan((b) => ({ x: b.x + panX, y: b.y + panY }));
      panRef.current = null;
    }
    setPinchScale(1);
    setPanX(0);
    setPanY(0);
  };

  if (status !== 'ready') {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>HOLE FLYOVER</Text>
          <Text style={styles.sub}>{round.courseName}</Text>
        </View>
        <View style={styles.center}>
          {status === 'error' ? (
            <>
              <Text style={styles.msg}>{message}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={start}>
                <Text style={styles.retryBtnText}>Try again</Text>
              </TouchableOpacity>
              {fbPos ? (
                <View style={styles.fbBox}>
                  <Text style={styles.fbCoord}>GPS active · {fbPos.lat.toFixed(5)}, {fbPos.lon.toFixed(5)}</Text>
                  {green ? (
                    <Text style={styles.fbDist}>{Math.round(distanceMetres(fbPos, green))} m to marked green</Text>
                  ) : (
                    <Text style={styles.fbHint}>Stand on the green, then tap below to measure distance to it.</Text>
                  )}
                  <TouchableOpacity style={styles.fbBtn} onPress={() => setGreen(fbPos)}>
                    <Text style={styles.fbBtnText}>{green ? 'Re-mark green here' : 'Mark green at my spot'}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <ActivityIndicator color={colors.green} size="large" />
              <Text style={styles.msg}>{message}</Text>
            </>
          )}
        </View>
      </View>
    );
  }

  const hole = holes[idx];
  const { w, h } = layout;

  // ----- GameBook-style camera: you at the bottom, green straight up -----
  const liveCandidate =
    pos &&
    distanceMetres(pos, hole.green) >= 12 &&
    distanceMetres(pos, hole.green) <= 900
      ? pos
      : null;
  let cam = camRef.current;
  if (!cam || cam.idx !== idx) {
    cam = { idx, anchor: liveCandidate ?? hole.tee };
    camRef.current = cam;
  } else if (liveCandidate && distanceMetres(cam.anchor, liveCandidate) > 30) {
    cam = { idx, anchor: liveCandidate };
    camRef.current = cam;
  }
  const anchor = cam.anchor;
  const bearing = bearingDeg(anchor, hole.green);
  const holeDist = Math.max(60, distanceMetres(anchor, hole.green));

  // Square canvas TWICE the screen diagonal: pan/zoom are pure screen
  // transforms over this one cached image, so gestures never refetch it.
  const S = w > 0 && h > 0 ? Math.ceil(Math.hypot(w, h)) : 0;
  const C = S * 2;
  // The anchor-to-green line fills ~58% of the screen height.
  const viewM = Math.min(1600, Math.max(120, holeDist / 0.58));
  const mpp = h > 0 ? viewM / h : 0; // ground metres per screen pixel
  const centre: LatLon = {
    lat: (anchor.lat + hole.green.lat) / 2,
    lon: (anchor.lon + hole.green.lon) / 2,
  };
  const bbox: BBox | null =
    C > 0 && mpp > 0 ? squareBBoxM(centre, mpp * C) : null;

  const sp = startPt ?? hole.tee;
  const ap = aim ?? mid(hole.tee, hole.green);
  const ep = endPt ?? hole.green;

  const seg1 = distanceMetres(sp, ap); // start -> aim
  const seg2 = distanceMetres(ap, ep); // aim -> end
  const toGreenLive = pos ? distanceMetres(pos, hole.green) : null;
  const greenPoly = (greens && hole && hole.green) ? pickGreenForHole(hole.green, greens) : null;
  const fmb = (greenPoly && pos) ? fmbMetres(pos, greenPoly) : (pos && hole && hole.green) ? fmbFromCenter(pos, hole.green) : null;

  const px = (p: LatLon) => (bbox ? project(p, bbox, C, C) : { x: 0, y: 0 });
  const spPx = px(sp);
  const apPx = px(ap);
  const epPx = px(ep);
  const posPx = pos ? px(pos) : null;
  const mid1 = px(mid(sp, ap));
  const mid2 = px(mid(ap, ep));

  // keep refs current for touch handlers
  geoRef.current = {
    bbox,
    w,
    h,
    S: C,
    bearing,
    panTx: basePan.x + panX,
    panTy: basePan.y + panY,
    scale: zoom * pinchScale,
  };
  handlesRef.current = { s: spPx, a: apPx, e: epPx };

  const par =
    hole.par ?? (hole.holeRef ? round.holes[hole.holeRef - 1]?.par : null);
  const holeLabel =
    hole.holeRef != null ? `Hole ${hole.holeRef}` : `Hole ${idx + 1}`;

  return (
    <View style={styles.screen}>
      <View
        style={styles.mapArea}
        onLayout={(e) =>
          setLayout({
            w: e.nativeEvent.layout.width,
            h: e.nativeEvent.layout.height,
          })
        }
      >
        {bbox ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                transform: [
                  { translateX: basePan.x + panX },
                  { translateY: basePan.y + panY },
                  { scale: zoom * pinchScale },
                ],
              },
            ]}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={onGrant}
            onResponderMove={onMove}
            onResponderRelease={onRelease}
            onResponderTerminate={onRelease}
          >
            {/* Rotated canvas: square satellite image + overlays, turned so
                the anchor-to-green line runs straight up the screen. */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: (w - C) / 2,
                top: (h - C) / 2,
                width: C,
                height: C,
                transform: [{ rotate: `${-bearing}deg` }],
              }}
            >
            <Image
              key={`${idx}-${C}`}
              source={{ uri: esriImageUrlMerc(bbox, C, C) }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={() => setImgError(true)}
              onLoad={() => setImgError(false)}
            />
            <Svg style={StyleSheet.absoluteFill} width={C} height={C}>
              <SvgPolyline
                points={`${spPx.x},${spPx.y} ${apPx.x},${apPx.y} ${epPx.x},${epPx.y}`}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={3}
                strokeLinejoin="round"
              />
              {posPx ? (
                <Circle
                  cx={posPx.x}
                  cy={posPx.y}
                  r={7}
                  fill="#2BA84A"
                  stroke="#fff"
                  strokeWidth={2}
                />
              ) : null}
            </Svg>

            {/* draggable handles */}
            <View
              style={[styles.dot, { left: spPx.x - 11, top: spPx.y - 11 }]}
              pointerEvents="none"
            />
            <View
              style={[styles.aimRing, { left: apPx.x - 20, top: apPx.y - 20 }]}
              pointerEvents="none"
            >
              <View style={styles.aimDot} />
            </View>
            <View
              style={[styles.endRing, { left: epPx.x - 16, top: epPx.y - 16 }]}
              pointerEvents="none"
            >
              <View style={styles.endDot} />
            </View>

            {/* distance bubbles */}
            <View
              style={[
                styles.bubble,
                {
                  left: mid1.x - 26,
                  top: mid1.y - 16,
                  transform: [{ rotate: `${bearing}deg` }],
                },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.bubbleText}>{fmt(seg1)}</Text>
            </View>
            <View
              style={[
                styles.bubble,
                {
                  left: mid2.x - 26,
                  top: mid2.y - 16,
                  transform: [{ rotate: `${bearing}deg` }],
                },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.bubbleText}>{fmt(seg2)}</Text>
            </View>
            </View>
          </View>
        ) : null}

        {/* Top header */}
        <View style={styles.topRow} pointerEvents="box-none">
          {onBack ? (
            <TouchableOpacity style={styles.backBtn} onPress={onBack}>
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}
          <View style={styles.headerPill}>
            <Text style={styles.headerPillText}>
              {holeLabel}
              {par ? ` | Par ${par}` : ''} | {fmt(hole.lengthM)}
              {units}
            </Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        {/* Left cards */}
        <View style={styles.leftCards} pointerEvents="none">
          <View style={styles.card}>
            <Text style={styles.cardLabel}>MEASURE</Text>
            <Text style={styles.cardValue}>{fmt(seg1 + seg2)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>GREEN</Text>
            <Text style={styles.cardValue}>
              {toGreenLive != null ? fmt(toGreenLive) : '—'}
            </Text>
          </View>
        {fmb ? (
          <View pointerEvents="none" style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 14 }}>
            <View style={{ alignItems: 'center', marginHorizontal: 9 }}>
              <Text style={{ color: '#9CD67D', fontSize: 10, fontWeight: '800' }}>FRONT</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>{fmt(fmb.front)}</Text>
            </View>
            <View style={{ alignItems: 'center', marginHorizontal: 9 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>MIDDLE</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>{fmt(fmb.middle)}</Text>
            </View>
            <View style={{ alignItems: 'center', marginHorizontal: 9 }}>
              <Text style={{ color: '#F0A6A6', fontSize: 10, fontWeight: '800' }}>BACK</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>{fmt(fmb.back)}</Text>
            </View>
          </View>
        ) : null}
        </View>

        {imgError ? (
          <View style={styles.imgErr} pointerEvents="none">
            <Text style={styles.imgErrText}>
              Could not load the satellite image. Check your connection.
            </Text>
          </View>
        ) : null}

        {/* Hole prev / next */}
        <TouchableOpacity
          style={[styles.holeNav, styles.holeNavLeft]}
          onPress={() => goHole(idx - 1)}
        >
          <Text style={styles.holeNavText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.holeNav, styles.holeNavRight]}
          onPress={() => goHole(idx + 1)}
        >
          <Text style={styles.holeNavText}>›</Text>
        </TouchableOpacity>

        {/* Bottom controls */}
        <View style={styles.bottomRow} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.roundBtn}
            onPress={() => setUnits((u) => (u === 'm' ? 'yd' : 'm'))}
          >
            <Text style={styles.roundBtnTop}>{units.toUpperCase()}</Text>
            <Text style={styles.roundBtnSub}>units</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.measureBtn} onPress={() => resetLine(hole)}>
            <Text style={styles.measureText}>RESET{'\n'}LINE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.roundBtn}
            onPress={() => {
              if (pos) goHole(nearestHoleIndex(pos, holes));
            }}
          >
            <Text style={styles.roundBtnTop}>⌖</Text>
            <Text style={styles.roundBtnSub}>my hole</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fbBox: { marginTop: 22, alignItems: 'center', paddingHorizontal: 20 },
  fbCoord: { color: colors.textMuted, fontSize: 13, marginBottom: 6 },
  fbDist: { color: colors.green, fontSize: 30, fontWeight: '900', marginBottom: 10 },
  fbHint: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 12 },
  fbBtn: { backgroundColor: colors.green, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24 },
  fbBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  screen: { flex: 1, backgroundColor: colors.bgDarker },
  mapArea: { flex: 1, backgroundColor: '#0d1b12' },
  header: {
    backgroundColor: colors.bgDark,
    paddingTop: 58,
    paddingBottom: 12,
    alignItems: 'center',
  },
  title: {
    color: colors.textOnDark,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  sub: { color: colors.textOnDarkMuted, fontSize: 12, marginTop: 2 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  msg: {
    color: colors.textOnDark,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 18,
    backgroundColor: colors.green,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  retryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  topRow: {
    position: 'absolute',
    top: 30,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    marginTop: -2,
  },
  headerPill: {
    flex: 1,
    marginHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.pill,
    paddingVertical: 11,
    alignItems: 'center',
  },
  headerPillText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  leftCards: { position: 'absolute', top: 92, left: 12, gap: 8 },
  card: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 92,
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardValue: { color: '#fff', fontSize: 32, fontWeight: '900', lineHeight: 36 },
  holeNav: {
    position: 'absolute',
    top: '46%',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holeNavLeft: { left: 10 },
  holeNavRight: { right: 10 },
  holeNavText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  dot: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.35)',
  },
  aimRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aimDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  endRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  endDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  bubble: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    minWidth: 52,
    alignItems: 'center',
  },
  bubbleText: { color: colors.text, fontWeight: '900', fontSize: 16 },
  imgErr: {
    position: 'absolute',
    top: '48%',
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 12,
  },
  imgErrText: { color: '#fff', fontSize: 13, textAlign: 'center' },
  bottomRow: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  roundBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtnTop: { color: '#fff', fontSize: 20, fontWeight: '900' },
  roundBtnSub: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2 },
  measureBtn: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  measureText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 18,
  },
});
