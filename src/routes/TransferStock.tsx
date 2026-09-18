import { useMemo, useState } from 'react';
import { PlaceholderImage } from '../components/PlaceholderImage';
import { ImageCredit } from '../components/ImageCredit';
import { useApproved, useAssignments } from '../image-library/useImageLibrary';
import { resolveImage } from '../image-library/resolve-image';
import { requiresAttribution } from '../image-library/license-policy';

/**
 * The "Transfer stock" storeroom screen.
 *
 * Every row previously reused one shared thumbnail. Each row now names the placeholder
 * slot its equipment belongs to, so an approved photo can land on it without touching
 * this file again.
 */

interface StockItem {
  key: string;
  name: string;
  placeholderId: string;
}

const STOCK_ITEMS: StockItem[] = [
  { key: 'row-1', name: 'Digital Stethoscope', placeholderId: 'digital-stethoscope' },
  { key: 'row-2', name: 'Blood Pressure Cuff', placeholderId: 'blood-pressure-cuff' },
  { key: 'row-3', name: 'Surgical Headlamp', placeholderId: 'surgical-headlamp' },
  { key: 'row-4', name: 'Aircast Walking Boot', placeholderId: 'aircast-walking-boot' },
  { key: 'row-5', name: 'Aircast Walking Boot', placeholderId: 'aircast-walking-boot' },
  { key: 'row-6', name: 'Aircast Walking Boot', placeholderId: 'aircast-walking-boot' },
  { key: 'row-7', name: 'Surgical Suture Kit 3-0', placeholderId: 'surgical-suture-kit' },
  { key: 'row-8', name: 'Aircast Walking Boot', placeholderId: 'aircast-walking-boot' },
];

export function TransferStock() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const approved = useApproved();
  const assignments = useAssignments();

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const add = (key: string) => setCounts((c) => ({ ...c, [key]: (c[key] ?? 0) + 1 }));

  /**
   * Accessible credit area: one entry per distinct CC BY image on screen, so the
   * dense list keeps its layout while attribution stays visible on the page.
   */
  const credits = useMemo(() => {
    const seen = new Map<string, ReturnType<typeof resolveImage>>();
    for (const item of STOCK_ITEMS) {
      const img = resolveImage(item.placeholderId, approved, assignments);
      if (img && requiresAttribution(img.license) && !seen.has(img.id)) seen.set(img.id, img);
    }
    return [...seen.values()].filter((i): i is NonNullable<typeof i> => i !== null);
  }, [approved, assignments]);

  return (
    <div className="screen">
      <header className="appbar">
        <div className="appbar__top">
          <button className="iconbtn iconbtn--back" aria-label="Go back">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
          </button>
          <div className="appbar__titles">
            <p className="appbar__eyebrow">Stock actions</p>
            <h1 className="appbar__title">
              Transfer stock
              <svg className="appbar__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </h1>
          </div>
          <button className="iconbtn iconbtn--qr" aria-label="Scan QR code">
            {/* Filled QR glyph: three finder squares plus a scatter of modules, as in the
                design. Drawn with fill rather than stroke so it reads solid at 24px. */}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5z"
              />
              <path d="M6 6h2v2H6zM16 6h2v2h-2zM6 16h2v2H6z" />
              <path d="M13 13h3v2h-3zM18 13h3v2h-3zM13 16h2v5h-2zM17 16h2v2h-2zM19 18h2v3h-2zM16 19h2v2h-2z" />
            </svg>
          </button>
        </div>

        <div className="searchrow">
          <label className="search" htmlFor="storeroom-search">
            <svg className="search__icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
            </svg>
            <input id="storeroom-search" type="search" placeholder="Search storeroom" />
          </label>
          <button className="iconbtn" aria-label="Filter items">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4" /></svg>
          </button>
        </div>
      </header>

      <main className="list">
        <div className="list__head">
          <h2 className="list__title">Items in your storeroom</h2>
          <button className="linkbtn">All items</button>
        </div>

        <ul className="items">
          {STOCK_ITEMS.map((item) => {
            const image = resolveImage(item.placeholderId, approved, assignments);
            return (
              <li className="item" key={item.key}>
                <PlaceholderImage placeholderId={item.placeholderId} alt={item.name} />
                <div className="item__body">
                  <span className="item__name">{item.name}</span>
                  {image ? <ImageCredit image={image} /> : null}
                </div>
                {counts[item.key] ? <span className="item__count">{counts[item.key]}</span> : null}
                <button className="addbtn" onClick={() => add(item.key)} aria-label={`Add ${item.name}`}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                </button>
              </li>
            );
          })}
        </ul>

        {credits.length > 0 && (
          <section className="credits" aria-label="Image credits">
            <h2 className="credits__title">Image credits</h2>
            <ul>
              {credits.map((image) => (
                <li key={image.id}>
                  <ImageCredit image={image} variant="block" />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="actionbar">
        <span className="pill">{total} {total === 1 ? 'Item' : 'Items'}</span>
        <button className="primary">Next step</button>
      </footer>
    </div>
  );
}
