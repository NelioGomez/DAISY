import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/common/Logo';
import { useToast } from '../../components/feedback/useToast';
import { isModuleId, visibleModules } from '../../config/navigation';
import { REMEMBER_USER_KEY, SHOW_DEMO_ACCOUNTS, USERNAME_MAX } from '../../config/security';
import { ACCESS, MODULE_COUNT, ROLES, ROLE_KEYS } from '../../config/navigation';
import { useAuth } from '../../store/hooks';
import type { SessionUser } from '../../types';
import type { LoginRedirectState } from '../../app/router/guards';
import { AuthLayout } from './AuthLayout';
import { DemoAccounts } from './DemoAccounts';
import { AlertIcon, CheckIcon, InfoIcon, UserIcon } from './icons';
import { PasswordField } from './PasswordField';

type Notice = { tone: 'error' | 'warning' | 'info' | 'success'; text: string } | null;

function readRememberedUser(): string {
  try {
    return localStorage.getItem(REMEMBER_USER_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeRememberedUser(username: string | null): void {
  try {
    if (username) localStorage.setItem(REMEMBER_USER_KEY, username);
    else localStorage.removeItem(REMEMBER_USER_KEY);
  } catch {
    /* almacenamiento no disponible: se ignora */
  }
}

/** Ruta a la que se vuelve tras iniciar sesión, si el usuario tiene acceso a ella. */
function destinationFor(user: SessionUser, from?: string): string {
  const allowed = visibleModules(user);
  const mod = from?.match(/^\/app\/([^/]+)/)?.[1];
  if (isModuleId(mod) && allowed.includes(mod)) return `/app/${mod}`;
  return allowed[0] ? `/app/${allowed[0]}` : '/app';
}

const formatCountdown = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
import type { RoleKey } from '../../types';

export function LoginPage() {
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  // Tras un cierre manual no se vuelve a la vista anterior (puede entrar otra persona).
  const navState = (location.state as LoginRedirectState | null) ?? {};
  const from = lastLogout?.reason === 'manual' ? undefined : navState.from;

  // Tras un cierre por inactividad o un cambio de contraseña se conserva el usuario.
  const [username, setUsername] = useState(
    () => navState.resetUsername ?? (lastLogout && lastLogout.reason !== 'manual' ? lastLogout.username : readRememberedUser()),
  );
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => readRememberedUser() !== '');
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [notice, setNotice] = useState<Notice>(() =>
    navState.resetUsername
      ? navState.resetSimulated
        ? { tone: 'info', text: 'Recuperación simulada completada. El servidor aún no tiene este proceso, así que su contraseña real no cambió.' }
        : { tone: 'success', text: 'Contraseña actualizada. Inicie sesión con su nueva contraseña.' }
      : lastLogout?.reason === 'idle'
        ? { tone: 'info', text: 'Su sesión se cerró por inactividad. Inicie sesión para continuar donde estaba.' }
        : lastLogout?.reason === 'expired'
          ? { tone: 'info', text: 'Su sesión venció por seguridad. Inicie sesión para continuar donde estaba.' }
          : lastLogout?.reason === 'offline'
            ? { tone: 'warning', text: 'No se pudo conectar con el servidor para recuperar su sesión. Revise su conexión e intente de nuevo.' }
            : null,
  );
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [role, setRole] = useState<RoleKey>('admin');
  const [username, setUsername] = useState(ROLES.admin.user);
  const [password, setPassword] = useState('••••••••');

  if (user) return <Navigate to="/app" replace />;

  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  const secondsLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  // El servidor limita los intentos por dirección IP, no por usuario.
  const locked = secondsLeft > 0;

  // Foco inicial: usuario vacío → usuario; usuario recordado → contraseña.
  useEffect(() => {
    (username ? passRef : userRef).current?.focus();
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuenta regresiva del bloqueo temporal.
  useEffect(() => {
    if (!lockedUntil) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= lockedUntil) {
        clearInterval(t);
        setLockedUntil(0);
        setNotice(null);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  if (user) return <Navigate to={destinationFor(user, from)} replace />;

  const validate = () => {
    const e: typeof errors = {};
    if (!username.trim()) e.username = 'Escriba su usuario.';
    if (!password) e.password = 'Escriba su contraseña.';
    setErrors(e);
    return e;
  const selectRole = (r: RoleKey) => {
    setRole(r);
    setUsername(ROLES[r].user);
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (loading || locked) return;
    const e = validate();
    if (e.username) return userRef.current?.focus();
    if (e.password) return passRef.current?.focus();

    setLoading(true);
    setNotice(null);
    const res = await login(username, password);
    setLoading(false);

    if (res.ok) {
      storeRememberedUser(remember ? res.user.user : null);
      toast('Sesión iniciada como ' + res.user.name, 'ok');
      navigate(destinationFor(res.user, from), { replace: true });
      return;
    }

    setPassword('');
    if (res.code === 'LOCKED') {
      const until = Date.now() + res.retryAfter * 1000;
      setNow(Date.now());
      setLockedUntil(until);
      setNotice({ tone: 'warning', text: res.message });
    } else if (res.code === 'INVALID_CREDENTIALS') {
      // El dato de intentos restantes viene del límite real del servidor (X-RateLimit-Remaining).
      const n = res.remainingAttempts;
      const extra = n === null || n > 2 ? '' : n <= 0 ? ' El siguiente intento fallido bloqueará el acceso por un minuto.' : n === 1 ? ' Le queda 1 intento antes del bloqueo temporal.' : ` Le quedan ${n} intentos antes del bloqueo temporal.`;
      setNotice({ tone: 'error', text: res.message + extra });
    } else {
      setNotice({ tone: res.code === 'NETWORK' ? 'warning' : 'error', text: res.message });
    }
    passRef.current?.focus();
  };

  const pickDemo = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrors({});
    setNotice(null);
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Autenticación simulada: la contraseña aún no se valida (se hará con /auth/login en NestJS).
    const u = login(role, username);
    toast('Sesión iniciada como ' + u.name, 'ok');
    navigate(`/app/${ACCESS[role][0]}`);
  };

  return (
    <section id="login">
      <div className="login-box">
        <div className="login-brand">
          <Logo />
          <h1>Sistema Web de Gestión de Ventas y Control de Inventario</h1>
          <p>Plataforma empresarial para administrar inventario, ventas, cotizaciones, facturación, pagos, reportes y catálogo web de repuestos para gasolineras.</p>
          <div className="login-meta">
            <div>
              <b>N-Capas</b>
              <span>Arquitectura</span>
            </div>
            <div>
              <b>NestJS · React</b>
              <span>Stack base</span>
            </div>
            <div>
              <b>{ROLE_KEYS.length} roles</b>
              <span>Acceso</span>
            </div>
            <div>
              <b>{MODULE_COUNT} módulos</b>
              <span>Operación</span>
            </div>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <h2>Iniciar sesión</h2>
          <div className="sub">Seleccione un rol para acceder al panel correspondiente.</div>
          <div className="roles">
            {ROLE_KEYS.map((k) => (
              <button type="button" key={k} className={`role-btn ${role === k ? 'sel' : ''}`} onClick={() => selectRole(k)}>
                <b>{ROLES[k].name}</b>
                <span>{ROLES[k].desc}</span>
              </button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="luser">Usuario</label>
            <input id="luser" value={username} placeholder="usuario" onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="lpass">Contraseña</label>
            <input id="lpass" type="password" value={password} placeholder="contraseña" onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-amber">
            Ingresar al sistema
          </button>
          <button type="button" className="link" onClick={() => navigate('/catalogo')}>
            Ver catálogo web público →
          </button>
        </form>
      </div>
    </section>
  );
}
