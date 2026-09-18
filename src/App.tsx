import { useEffect, useState } from 'react';
import { TransferStock } from './routes/TransferStock';
import { AdminImageLibrary } from './routes/AdminImageLibrary';

const ADMIN_ROUTE = '#/admin/image-library';

/**
 * Minimal hash routing for the prototype.
 *
 * The Image Library lives on its own route and is deliberately absent from the app's
 * own navigation — the only way in is the chrome link outside the phone frame. In a
 * real deployment this route sits behind the admin auth guard.
 */
export function App() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const isAdmin = hash === ADMIN_ROUTE;

  return (
    <div className="shell">
      <nav className="chrome">
        <a href="#/" className={!isAdmin ? 'chrome__on' : ''}>Transfer stock</a>
        <a href={ADMIN_ROUTE} className={isAdmin ? 'chrome__on' : ''}>Image Library (admin)</a>
      </nav>
      {isAdmin ? (
        <AdminImageLibrary />
      ) : (
        <div className="phone">
          <TransferStock />
        </div>
      )}
    </div>
  );
}
