import { useState, useEffect, useRef } from 'react';

/**
 * Filovita 起動アニメーション(改訂版)
 *
 * 演出の順番:
 *   1. 留め金が外れる(カチッ)
 *   2. 表紙が横にずれて開く(回転ではなくスライド)
 *   3. ロゴがインクのように紙に染み出す
 *
 * 初回は 1.6 秒のフル演出、2回目以降は 0.5 秒の短縮版になる
 * (localStorage の 'filovita_visited' で判定)
 *
 * フォントについて:
 *   外部フォントには依存していません。「FILOVITA」の8文字は、
 *   ウィーン分離派のポスター文字を参考にゼロから座標を描き起こした
 *   オリジナルの字形(SVGパス)です。フォントのインストール状況に
 *   関わらず、常に同じ形で表示されます。
 */
export default function NotebookOpen({ onDone }) {
  const isFirstVisit = useRef(
    typeof window !== 'undefined' && !window.localStorage.getItem('filovita_visited')
  );
  const claspMs = isFirstVisit.current ? 350 : 150;
  const openMs = isFirstVisit.current ? 900 : 250;
  const inkMs = isFirstVisit.current ? 900 : 200;

  const [claspOff, setClaspOff] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [showLogo, setShowLogo] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setClaspOff(true), 50);
    const t2 = setTimeout(() => setCoverOpen(true), 50 + claspMs);
    const t3 = setTimeout(() => setShowLogo(true), 50 + claspMs + openMs * 0.4);
    const t4 = setTimeout(() => {
      window.localStorage.setItem('filovita_visited', '1');
      onDone && onDone();
    }, 50 + claspMs + openMs + inkMs * 0.5);
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, [claspMs, openMs, inkMs, onDone]);

  return (
    <div style={styles.wrap}>
      <div style={styles.stage}>
        {/* 中のページ(紙の質感) */}
        <div style={styles.page}>
          <svg width="120" height="130" viewBox="0 0 400 280" style={{ marginBottom: 4 }}>
            {/* 執事のシルエット(常時表示) */}
            <g transform="translate(200,110) scale(1.7)" fill="none">
              <rect x="-18" y="-34" width="36" height="12" rx="2" fill="#5A3A24" />
              <rect x="-22" y="-25" width="44" height="4" rx="2" fill="#5A3A24" />
              <circle cx="0" cy="-2" r="17" fill="#E8CBB0" />
              <path d="M -19 17 Q -19 -6 0 -6 Q 19 -6 19 17 L 19 29 L -19 29 Z" fill="#5A3A24" />
              <rect x="-5" y="6" width="10" height="13" fill="#F6F1E7" />
              <path d="M -2.5 7.5 L 2.5 7.5 L 0 15 Z" fill="#9C7A3C" />
            </g>
            {/* FILOVITA オリジナル字形(インクのように浮かび上がる) */}
            <g
              transform="translate(70,210) scale(0.42)"
              fill="#8A6E4A"
              style={{
                opacity: showLogo ? 1 : 0,
                filter: showLogo ? 'blur(0px)' : 'blur(4px)',
                transition: `opacity ${inkMs}ms ease, filter ${inkMs}ms ease`,
              }}
            >
              <path d="M40 30 L40 110 L58 110 L58 78 L92 78 L92 62 L58 62 L58 46 L100 46 L100 30 Z" />
              <path d="M118 30 L118 110 L136 110 L136 30 Z" />
              <path d="M156 30 L156 110 L220 110 L220 94 L174 94 L174 30 Z" />
              <path d="M238 70 Q238 30 278 30 Q318 30 318 70 Q318 110 278 110 Q238 110 238 70 Z M256 70 Q256 46 278 46 Q300 46 300 70 Q300 94 278 94 Q256 94 256 70 Z" />
              <path d="M330 30 L360 110 L378 110 L408 30 L389 30 L369 88 L349 30 Z" />
              <path d="M424 30 L424 110 L442 110 L442 30 Z" />
              <path d="M456 30 L456 46 L484 46 L484 110 L502 110 L502 46 L530 46 L530 30 Z" />
              <path d="M572 30 L536 110 L555 110 L563 92 L601 92 L609 110 L628 110 L592 30 Z M582 60 L570 78 L594 78 Z" />
            </g>
          </svg>
          <div
            style={{
              ...styles.tagline,
              opacity: showLogo ? 1 : 0,
              transition: `opacity ${inkMs}ms ease ${inkMs * 0.3}ms`,
            }}
          >
            今日の暮らしを開く
          </div>
        </div>

        {/* 表紙(横にずれて開く) */}
        <div
          style={{
            ...styles.cover,
            transform: coverOpen ? 'translateX(-100%)' : 'translateX(0)',
            boxShadow: coverOpen ? '0 0 0 rgba(0,0,0,0)' : '2px 0 8px rgba(0,0,0,0.25)',
            transition: `transform ${openMs}ms ease-in-out, box-shadow ${openMs}ms ease`,
          }}
        >
          <div style={styles.coverBorder} />
          {/* 留め金 */}
          <div
            style={{
              ...styles.clasp,
              opacity: claspOff ? 0 : 1,
              transform: claspOff ? 'translateY(-50%) scale(0.6)' : 'translateY(-50%) scale(1)',
              transition: `opacity ${claspMs}ms ease, transform ${claspMs}ms ease`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    background: '#F6F1E7',
  },
  stage: {
    position: 'relative',
    width: '100%',
    maxWidth: 320,
    aspectRatio: '3 / 4',
    overflow: 'hidden',
    borderRadius: 8,
  },
  page: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.5), transparent 40%), #F6F1E7',
    border: '0.5px solid #E4DCCB',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    fontSize: 11,
    color: '#B4A588',
    letterSpacing: '0.1em',
    marginTop: 8,
  },
  cover: {
    position: 'absolute',
    inset: 0,
    background: '#5A3A24',
    transformOrigin: 'left center',
  },
  clasp: {
    position: 'absolute',
    top: '50%',
    right: 16,
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#9C7A3C',
  },
  coverBorder: {
    position: 'absolute',
    inset: 12,
    border: '1px solid rgba(156,122,60,0.53)',
    borderRadius: 4,
  },
};
