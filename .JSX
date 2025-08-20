import React, { useMemo, useState, useEffect } from "react";

// -----------------------------
// Simple in-memory data + helpers
// -----------------------------
const CURRENCY = (n) => `$${n.toFixed(2)}`;

const FEATURE_FLAGS = {
  // Flip these to expose realistic bugs for learners
  BUG_TAX_RATE_ROUNDING: true, // calculates tax with premature rounding
  BUG_RESERVATION_MIN_PARTY: true, // allows party size below minimum via keyboard edit
  BUG_EXPIRY_LENIENT: true, // checkout accepts expired cards if month/year format looks right
  BUG_SEARCH_CASE_SENSITIVE: true, // menu search is case-sensitive when it shouldn't be
};

const TAX_RATE = 0.0825; // 8.25%
const MIN_PARTY_SIZE = 2;

const MENU = [
  { id: "m1", name: "Margherita Pizza", price: 11.5, tags: ["veg", "pizza"] },
  { id: "m2", name: "Pepperoni Pizza", price: 13.0, tags: ["pizza"] },
  { id: "m3", name: "Paneer Tikka", price: 12.0, tags: ["veg", "indian"] },
  { id: "m4", name: "Chicken Biryani", price: 14.25, tags: ["indian"] },
  { id: "m5", name: "Caesar Salad", price: 9.5, tags: ["salad"] },
  { id: "m6", name: "Butter Naan", price: 3.5, tags: ["indian", "bread"] },
  { id: "m7", name: "Tomato Soup", price: 6.75, tags: ["soup", "veg"] },
  { id: "m8", name: "Gulab Jamun", price: 5.25, tags: ["dessert", "indian"] },
];

function Button({ children, onClick, className = "", type = "button", disabled }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`px-4 py-2 rounded-2xl shadow text-sm font-medium border hover:shadow-md active:scale-[0.98] disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl shadow p-4 bg-white ${className}`}>{children}</div>
  );
}

function Field({ label, children, required }) {
  return (
    <label className="block mb-3">
      <div className="text-sm text-gray-700 mb-1">
        {label} {required && <span className="text-red-600">*</span>}
      </div>
      {children}
    </label>
  );
}

// -----------------------------
// Cart logic
// -----------------------------
function useCart() {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem("qa_cart");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem("qa_cart", JSON.stringify(items));
  }, [items]);

  const add = (id) => setItems((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  const remove = (id) => setItems((prev) => {
    const qty = (prev[id] || 0) - 1;
    const next = { ...prev };
    if (qty <= 0) delete next[id];
    else next[id] = qty;
    return next;
  });
  const clear = () => setItems({});

  const lines = Object.entries(items).map(([id, qty]) => ({
    ...(MENU.find((m) => m.id === id) || { id, name: "Unknown", price: 0, tags: [] }),
    qty,
    subtotal: qty * (MENU.find((m) => m.id === id)?.price || 0),
  }));

  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
  const tax = FEATURE_FLAGS.BUG_TAX_RATE_ROUNDING
    ? Math.round(subtotal * TAX_RATE * 100) / 100 // premature rounding (bug)
    : subtotal * TAX_RATE; // precise, rounded only in UI
  const total = subtotal + tax;

  return { items, add, remove, clear, lines, subtotal, tax, total };
}

// -----------------------------
// Lightweight self-tests (to teach QA)
// -----------------------------
function runSelfTests() {
  const tests = [];
  const almost = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

  // SEARCH-001: Case-insensitive search
  {
    const q = "pizza";
    const expected = MENU.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));
    const actual = FEATURE_FLAGS.BUG_SEARCH_CASE_SENSITIVE
      ? MENU.filter((m) => m.name.includes(q))
      : expected;
    tests.push({
      id: "SEARCH-001",
      name: "Case-insensitive menu search",
      pass: actual.length === expected.length,
      details: `expected ${expected.length} matches, got ${actual.length}`,
    });
  }

  // TAX-001: No premature rounding
  {
    const subtotal = 1.0;
    const expectedTax = subtotal * TAX_RATE; // 0.0825
    const actualTax = FEATURE_FLAGS.BUG_TAX_RATE_ROUNDING
      ? Math.round(subtotal * TAX_RATE * 100) / 100
      : expectedTax;
    tests.push({
      id: "TAX-001",
      name: "Tax is not rounded prematurely",
      pass: !FEATURE_FLAGS.BUG_TAX_RATE_ROUNDING && almost(actualTax, expectedTax),
      details: `expected ${expectedTax.toFixed(4)}, got ${actualTax.toFixed(4)}`,
    });
  }

  // RES-001: Enforce min party size
  {
    const party = 1;
    const expectedOk = party >= MIN_PARTY_SIZE;
    const actualOk = FEATURE_FLAGS.BUG_RESERVATION_MIN_PARTY ? party >= 1 : expectedOk;
    tests.push({
      id: "RES-001",
      name: "Reservation enforces minimum party size",
      pass: actualOk === expectedOk,
      details: `party=${party}, expected allow=${expectedOk}, got ${actualOk}`,
    });
  }

  // PAY-001: Expired card is rejected
  {
    const expiry = "01/24"; // past
    const formatOk = /^\d{2}\/\d{2}$/.test(expiry);
    const expectedOk = formatOk && new Date(2000 + 24, 1, 0) >= new Date() ? true : false;
    const actualOk = FEATURE_FLAGS.BUG_EXPIRY_LENIENT ? formatOk : expectedOk;
    tests.push({
      id: "PAY-001",
      name: "Checkout rejects expired cards",
      pass: actualOk === expectedOk,
      details: `expiry=${expiry}, expected allow=${expectedOk}, got ${actualOk}`,
    });
  }

  // VAL-001: Phone format validation
  {
    const good = "+14085551234";
    const bad = "abc";
    const re = /^\+?\d{7,15}$/;
    const pass = re.test(good) && !re.test(bad);
    tests.push({ id: "VAL-001", name: "Phone validation basic checks", pass, details: `good=${good}, bad=${bad}` });
  }

  // UTIL-001: Currency formatting
  {
    const n = 1.2;
    const expected = "$1.20";
    const actual = CURRENCY(n);
    tests.push({ id: "UTIL-001", name: "Currency formats to two decimals", pass: actual === expected, details: `expected ${expected}, got ${actual}` });
  }

  return tests;
}

// -----------------------------
// Pages
// -----------------------------
function Navbar({ route, setRoute, cartCount }) {
  const NavBtn = ({ id, label }) => (
    <Button
      onClick={() => setRoute(id)}
      className={`mx-1 ${route === id ? "bg-black text-white" : "bg-white"}`}
    >
      {label}
    </Button>
  );

  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="font-semibold text-lg">TasteHub Restaurant</div>
        <div className="flex items-center gap-2">
          <NavBtn id="home" label="Home" />
          <NavBtn id="menu" label="Menu" />
          <NavBtn id="reserve" label="Reservations" />
          <NavBtn id="checkout" label={`Checkout (${cartCount})`} />
          <NavBtn id="admin" label="Admin" />
        </div>
      </div>
    </div>
  );
}

function Home() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <h2 className="text-xl font-semibold mb-2">Welcome</h2>
        <p className="text-gray-700">
          This lightweight app is built for QA training. Explore the menu, add items to your
          cart, make a reservation, and go through a mock checkout. Some features intentionally
          contain bugs behind flags for learners to discover.
        </p>
      </Card>
      <Card>
        <h2 className="text-xl font-semibold mb-2">Scenarios to Try</h2>
        <ul className="list-disc ml-5 text-gray-700 space-y-1">
          <li>Search menu items with different cases (e.g., "pizza" vs "Pizza").</li>
          <li>Create a reservation with party size {"< "}{MIN_PARTY_SIZE} using keyboard edits.</li>
          <li>Checkout using a past expiry date formatted as MM/YY.</li>
          <li>Compare order totals to confirm correct tax math.</li>
        </ul>
      </Card>
    </div>
  );
}

function MenuPage({ addToCart }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!q) return MENU;
    return MENU.filter((m) =>
      FEATURE_FLAGS.BUG_SEARCH_CASE_SENSITIVE
        ? m.name.includes(q) // BUG: case-sensitive search
        : m.name.toLowerCase().includes(q.toLowerCase())
    );
  }, [q]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <input
          className="border rounded-xl px-3 py-2 w-full"
          placeholder="Search menu..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <Card key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{item.name}</div>
                <div className="text-sm text-gray-600">{item.tags.join(", ")}</div>
              </div>
              <div className="text-right font-semibold">{CURRENCY(item.price)}</div>
            </div>
            <div className="mt-3">
              <Button className="bg-black text-white" onClick={() => addToCart(item.id)}>
                Add to Cart
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CheckoutPage({ cart, onOrderPlaced }) {
  const [form, setForm] = useState({ name: "", phone: "", card: "", expiry: "" });
  const [errors, setErrors] = useState({});

  const handleChange = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required.";
    if (!/^\+?\d{7,15}$/.test(form.phone)) e.phone = "Valid phone required (7-15 digits).";

    // Very naive card validation for demo purposes only
    if (!/^\d{12,19}$/.test(form.card.replaceAll(" ", ""))) e.card = "Enter 12-19 digits.";

    // BUG: accepts past dates if format matches
    if (FEATURE_FLAGS.BUG_EXPIRY_LENIENT) {
      if (!/^\d{2}\/\d{2}$/.test(form.expiry)) e.expiry = "Use MM/YY.";
    } else {
      if (!/^\d{2}\/\d{2}$/.test(form.expiry)) e.expiry = "Use MM/YY.";
      else {
        const [mm, yy] = form.expiry.split("/").map((n) => parseInt(n, 10));
        const now = new Date();
        const year = 2000 + yy;
        const lastDay = new Date(year, mm, 0);
        if (lastDay < now) e.expiry = "Card expired.";
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const placeOrder = () => {
    if (!validate()) return;
    const order = {
      id: `o_${Date.now()}`,
      items: cart.lines,
      totals: { subtotal: cart.subtotal, tax: cart.tax, total: cart.total },
      name: form.name,
      phone: form.phone,
      createdAt: new Date().toISOString(),
    };
    const all = JSON.parse(localStorage.getItem("qa_orders") || "[]");
    all.push(order);
    localStorage.setItem("qa_orders", JSON.stringify(all));
    onOrderPlaced(order);
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="md:col-span-2">
        <h2 className="text-lg font-semibold mb-3">Your Cart</h2>
        {cart.lines.length === 0 ? (
          <div className="text-gray-600">Cart is empty.</div>
        ) : (
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2">Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {cart.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="py-1">{l.name}</td>
                    <td>{l.qty}</td>
                    <td>{CURRENCY(l.price)}</td>
                    <td>{CURRENCY(l.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-right space-y-1">
              <div>Subtotal: <b>{CURRENCY(cart.subtotal)}</b></div>
              <div>Tax (8.25%): <b>{CURRENCY(cart.tax)}</b></div>
              <div className="text-lg">Total: <b>{CURRENCY(cart.total)}</b></div>
            </div>
          </div>
        )}
      </Card>
      <Card>
        <h2 className="text-lg font-semibold mb-3">Checkout</h2>
        <Field label="Full Name" required>
          <input className="border rounded-xl px-3 py-2 w-full" value={form.name} onChange={(e) => handleChange("name", e.target.value)} />
          {errors.name && <div className="text-red-600 text-sm mt-1">{errors.name}</div>}
        </Field>
        <Field label="Phone" required>
          <input className="border rounded-xl px-3 py-2 w-full" placeholder="e.g., +14085551234" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} />
          {errors.phone && <div className="text-red-600 text-sm mt-1">{errors.phone}</div>}
        </Field>
        <Field label="Card Number" required>
          <input className="border rounded-xl px-3 py-2 w-full" value={form.card} onChange={(e) => handleChange("card", e.target.value)} />
          {errors.card && <div className="text-red-600 text-sm mt-1">{errors.card}</div>}
        </Field>
        <Field label="Expiry (MM/YY)" required>
          <input className="border rounded-xl px-3 py-2 w-full" value={form.expiry} onChange={(e) => handleChange("expiry", e.target.value)} />
          {errors.expiry && <div className="text-red-600 text-sm mt-1">{errors.expiry}</div>}
        </Field>
        <Button className="bg-black text-white w-full" onClick={placeOrder} disabled={cart.lines.length === 0}>
          Place Order
        </Button>
      </Card>
    </div>
  );
}

function ReservationsPage() {
  const [form, setForm] = useState({ name: "", date: "", time: "", party: MIN_PARTY_SIZE });
  const [note, setNote] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const canSubmit = () => {
    const p = parseInt(form.party, 10);
    if (FEATURE_FLAGS.BUG_RESERVATION_MIN_PARTY) {
      return Boolean(form.name && form.date && form.time && p >= 1); // BUG: allows party size 1
    }
    return Boolean(form.name && form.date && form.time && p >= MIN_PARTY_SIZE);
  };

  const reserve = () => {
    if (!canSubmit()) {
      setNote(`Please fill all fields. Minimum party is ${MIN_PARTY_SIZE}.`);
      return;
    }
    const r = { id: `r_${Date.now()}`, ...form, createdAt: new Date().toISOString() };
    const all = JSON.parse(localStorage.getItem("qa_reservations") || "[]");
    all.push(r);
    localStorage.setItem("qa_reservations", JSON.stringify(all));
    setNote("Reservation submitted! Check Admin page.")
    setForm({ name: "", date: "", time: "", party: MIN_PARTY_SIZE });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <h2 className="text-lg font-semibold mb-3">Book a Table</h2>
        <Field label="Name" required>
          <input className="border rounded-xl px-3 py-2 w-full" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date" required>
            <input type="date" className="border rounded-xl px-3 py-2 w-full" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Time" required>
            <input type="time" className="border rounded-xl px-3 py-2 w-full" value={form.time} onChange={(e) => set("time", e.target.value)} />
          </Field>
          <Field label={`Party Size (min ${MIN_PARTY_SIZE})`} required>
            <input
              type="number"
              min={MIN_PARTY_SIZE}
              className="border rounded-xl px-3 py-2 w-full"
              value={form.party}
              onChange={(e) => set("party", e.target.value)}
            />
          </Field>
        </div>
        <Button className="bg-black text-white mt-2" onClick={reserve}>Reserve</Button>
        {note && <div className="mt-2 text-sm">{note}</div>}
      </Card>
      <Card>
        <h2 className="text-lg font-semibold mb-3">Tips</h2>
        <ul className="list-disc ml-5 text-gray-700 space-y-1 text-sm">
          <li>Try typing party size "1" directly and submitting.</li>
          <li>Use past dates to see validation behavior.</li>
        </ul>
      </Card>
    </div>
  );
}

function AdminPage() {
  const orders = JSON.parse(localStorage.getItem("qa_orders") || "[]");
  const reservations = JSON.parse(localStorage.getItem("qa_reservations") || "[]");
  const [tests, setTests] = useState(runSelfTests());

  const clearAll = () => {
    localStorage.removeItem("qa_orders");
    localStorage.removeItem("qa_reservations");
    window.location.reload();
  };

  const passed = tests.filter((t) => t.pass).length;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Orders</h2>
          <Button className="bg-white" onClick={clearAll}>Clear Demo Data</Button>
        </div>
        {orders.length === 0 ? (
          <div className="text-gray-600 text-sm">No orders yet.</div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-auto pr-1">
            {orders.map((o) => (
              <Card key={o.id} className="bg-gray-50">
                <div className="text-sm">Order <b>{o.id}</b> • {new Date(o.createdAt).toLocaleString()}</div>
                <div className="text-sm">Name: {o.name} • Phone: {o.phone}</div>
                <div className="text-sm mt-1">Total: <b>{CURRENCY(o.totals.total)}</b></div>
              </Card>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <h2 className="text-lg font-semibold mb-2">Reservations</h2>
        {reservations.length === 0 ? (
          <div className="text-gray-600 text-sm">No reservations yet.</div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-auto pr-1">
            {reservations.map((r) => (
              <Card key={r.id} className="bg-gray-50">
                <div className="text-sm">{new Date(r.createdAt).toLocaleString()}</div>
                <div className="text-sm">{r.name} — {r.date} {r.time} — Party {r.party}</div>
              </Card>
            ))}
          </div>
        )}
      </Card>
      <Card className="md:col-span-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Self Tests</h2>
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-600">{passed}/{tests.length} passed</div>
            <Button onClick={() => setTests(runSelfTests())}>Run tests</Button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="py-2">ID</th>
                <th>Test</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id}>
                  <td className="py-1 font-mono">{t.id}</td>
                  <td>{t.name}</td>
                  <td className={t.pass ? "text-green-700" : "text-red-700"}>{t.pass ? "PASS" : "FAIL"}</td>
                  <td className="text-gray-600">{t.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-gray-500 mt-2">Note: Several tests are expected to FAIL when the relevant BUG_ flags are enabled—useful for QA practice.</div>
      </Card>
    </div>
  );
}

// -----------------------------
// Root App
// -----------------------------
export default function App() {
  const [route, setRoute] = useState("home");
  const cart = useCart();

  const [toast, setToast] = useState("");
  const addToCart = (id) => {
    cart.add(id);
    setToast("Added to cart!");
    setTimeout(() => setToast(""), 800);
  };

  const onOrderPlaced = () => {
    cart.clear();
    setToast("Order placed (demo)!");
    setRoute("admin");
    setTimeout(() => setToast(""), 1200);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900">
      <Navbar route={route} setRoute={setRoute} cartCount={cart.lines.length} />
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-black text-white text-sm px-3 py-2 rounded-full shadow">
          {toast}
        </div>
      )}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {route === "home" && <Home />}
        {route === "menu" && <MenuPage addToCart={addToCart} />}
        {route === "checkout" && <CheckoutPage cart={cart} onOrderPlaced={onOrderPlaced} />}
        {route === "reserve" && <ReservationsPage />}
        {route === "admin" && <AdminPage />}
      </main>
      <footer className="text-center text-xs text-gray-500 py-8">
        QA Training Demo • Intentional bugs enabled • Local-only mock data
      </footer>
    </div>
  );
}
