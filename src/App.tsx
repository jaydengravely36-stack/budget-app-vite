import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronDown, ArrowUpDown, Plus, X, Trash2,
  Home, Wallet, Receipt, PiggyBank, BarChart3,
  ArrowLeft, AlertTriangle, CheckCircle2, CreditCard, CalendarClock,
} from "lucide-react";

const STORAGE_KEY = "budget-app-data-v3";

function uid() {
  return crypto.randomUUID();
}

// ---- palette (signature: deep indigo header + gold accent) ----
const INK = "#1B2233";
const HEADER = "#33406E";
const HEADER_DARK = "#2A3560";
const GOLD = "#C9972E";
const BG = "#A8D2EA";
const CARD = "#DEF1FA";
const MUTED = "#5D7C90";
const LINE = "#C4E2F0";
const RED = "#C0392B";
const GREEN = "#2F7D5A";
const RISK_BG = "#F7E3DE";
const RISK_ICON_BG = "#F0C2B4";
const OK_BG = "#DCEEE3";
const OK_ICON_BG = "#B9DFC8";
const FILL_BLUE = "#BFE0F2";
const FILL_RISK = "#F3CFC7";
const BUFFER_BOX = "#D8E3EE";

const fmt = (n) =>
  (n < 0 ? "-$" : "$") + Math.abs(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthLabel = () => new Date().toLocaleString(undefined, { month: "long" });
const yearLabel = () => new Date().getFullYear();

const FONT_BODY = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const FONT_DISPLAY = "'Fraunces', Georgia, 'Times New Roman', serif";

function useFontsAndViewport() {
  useEffect(() => {
    if (!document.getElementById("budget-app-fonts")) {
      const link = document.createElement("link");
      link.id = "budget-app-fonts";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(link);
    }
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
    }
    meta.content = "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover";
  }, []);
}

const DEFAULT_GROUPS = [
  { name: "Savings", items: ["Emergency Fund", "Car", "Vacation"] },
  { name: "Housing", items: ["Rent + Utility"] },
  { name: "Transportation", items: ["Gas", "Maintenance", "uber"] },
  { name: "Food", items: ["grocery refresh", "one-time purchase food"] },
  { name: "Personal", items: ["Clothing", "Phone", "Fun Money", "Hair/Cosmetics", "spotify", "apple", "verizon"] },
  { name: "Lifestyle", items: ["Credit Card", "due", "duee"] },
  { name: "Health", items: ["Gym"] },
  { name: "Insurance", items: ["Auto Insurance"] },
  { name: "Debt", items: [] },
].map((g) => ({
  id: uid(),
  name: g.name,
  items: g.items.map((n) => ({ id: uid(), name: n, planned: 0 })),
}));

function useData() {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      let parsed = {};
      try { parsed = saved ? JSON.parse(saved) : {}; } catch {}
      setData({
        incomeItems: [],
        groups: DEFAULT_GROUPS,
        goals: [],
        transactions: [],
        startingBuffer: 0,
        scheduledEvents: [],
        ...parsed
      });
    } catch {
      setData({
        incomeItems: [],
        groups: DEFAULT_GROUPS,
        goals: [],
        transactions: [],
        startingBuffer: 0,
        scheduledEvents: []
      });
    }
    setLoaded(true);
  }, []);

  const save = useCallback((next) => {
    setData(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    console.log("saved successfully");
  }, []);

  return { data, save, loaded };
}

export default function BudgetApp() {
  useFontsAndViewport();
  const { data, save, loaded } = useData();
  const [tab, setTab] = useState("budget");
  const [view, setView] = useState("planned"); // planned | spent | remaining
  const [addSheet, setAddSheet] = useState(false);
  const [modal, setModal] = useState(null); // 'income' | 'group' | 'item' | 'transaction' | 'goal' | 'schedule'
  const [itemGroupId, setItemGroupId] = useState(null);
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [editEvent, setEditEvent] = useState(null);
  const [planningOpen, setPlanningOpen] = useState(false);

  if (!loaded || !data) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: HEADER, fontFamily: FONT_BODY, fontSize: 14 }}>Loading budget…</div>
      </div>
    );
  }

  const { incomeItems, groups, goals, transactions } = data;
  const startingBuffer = data.startingBuffer || 0;
  const scheduledEvents = data.scheduledEvents || [];
  const allItems = groups.flatMap((g) => g.items.map((it) => ({ ...it, groupId: g.id, groupName: g.name })));

  const spentFor = (refId, type) =>
    transactions.filter((t) => t.refId === refId && t.type === type).reduce((s, t) => s + t.amount, 0);

  const totalPlannedIncome = incomeItems.reduce((s, i) => s + i.planned, 0);
  const totalReceivedIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalPlannedBudget = allItems.reduce((s, i) => s + i.planned, 0);
  const totalSpent = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const cashflow = totalPlannedIncome - totalPlannedBudget;

  const addIncomeItem = (item) => {
    save({ ...data, incomeItems: [...incomeItems, { ...item, id: uid() }] });
    setModal(null);
  };
  const addGroup = (name) => {
    save({ ...data, groups: [...groups, { id: uid(), name, items: [] }] });
    setModal(null);
  };
  const addItemToGroup = (groupId, item) => {
    save({
      ...data,
      groups: groups.map((g) => (g.id === groupId ? { ...g, items: [...g.items, { ...item, id: uid() }] } : g)),
    });
    setModal(null);
    setItemGroupId(null);
  };
  const addGoal = (g) => {
    save({ ...data, goals: [...goals, { ...g, id: uid(), saved: 0 }] });
    setModal(null);
  };
  const addTransaction = (t) => {
    save({ ...data, transactions: [{ ...t, id: uid() }, ...transactions] });
    setModal(null);
  };
  const deleteIncomeItem = (id) => save({ ...data, incomeItems: incomeItems.filter((i) => i.id !== id) });
  const deleteItem = (groupId, itemId) =>
    save({ ...data, groups: groups.map((g) => (g.id === groupId ? { ...g, items: g.items.filter((i) => i.id !== itemId) } : g)) });
  const renameIncomeItem = (id, name) =>
    save({ ...data, incomeItems: incomeItems.map((i) => (i.id === id ? { ...i, name } : i)) });
  const setIncomeItemPlanned = (id, planned) =>
    save({ ...data, incomeItems: incomeItems.map((i) => (i.id === id ? { ...i, planned } : i)) });
  const renameItem = (groupId, itemId, name) =>
    save({ ...data, groups: groups.map((g) => (g.id === groupId ? { ...g, items: g.items.map((it) => (it.id === itemId ? { ...it, name } : it)) } : g)) });
  const setItemPlanned = (groupId, itemId, planned) =>
    save({ ...data, groups: groups.map((g) => (g.id === groupId ? { ...g, items: g.items.map((it) => (it.id === itemId ? { ...it, planned } : it)) } : g)) });
  const deleteGoal = (id) => save({ ...data, goals: goals.filter((g) => g.id !== id) });
  const deleteTransaction = (id) => save({ ...data, transactions: transactions.filter((t) => t.id !== id) });
  const updateGoalSaved = (id, delta) =>
    save({ ...data, goals: goals.map((g) => (g.id === id ? { ...g, saved: Math.max(0, g.saved + delta) } : g)) });
  const setStartingBuffer = (v) => save({ ...data, startingBuffer: v });
  const addScheduledEvents = (events) => save({ ...data, scheduledEvents: [...scheduledEvents, ...events] });
  const deleteScheduledEvent = (id) => save({ ...data, scheduledEvents: scheduledEvents.filter((e) => e.id !== id) });
  const updateScheduledEvent = (id, patch) =>
    save({ ...data, scheduledEvents: scheduledEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const openSchedule = (target) => {
    setScheduleTarget(target);
    setModal("schedule");
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT_BODY, color: INK, display: "flex", flexDirection: "column" }}>
      <style>{`
        * { box-sizing: border-box; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
        html, body { touch-action: manipulation; }
        button { cursor: pointer; font-family: inherit; touch-action: manipulation; -webkit-tap-highlight-color: transparent; transition: transform 0.12s ease, background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease; }
        button:active { transform: scale(0.96); }
        input, select, textarea { font-size: 16px; touch-action: manipulation; transition: border-color 0.18s ease; }
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #8FBBD6; border-radius: 3px; }
        .fade-in-tab { animation: fadeSlideIn 0.24s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes backdropOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes sheetIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes sheetOut { from { transform: translateY(0); } to { transform: translateY(100%); } }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
      `}</style>

      <div key={`header-${tab}-${planningOpen}`} className="fade-in-tab">
        {tab === "budget" && planningOpen ? (
          <PlanningHeader onBack={() => setPlanningOpen(false)} />
        ) : tab === "budget" ? (
          <BudgetHeader view={view} setView={setView} onAdd={() => setAddSheet(true)} />
        ) : (
          <SimpleHeader title={tabTitle(tab)} onAdd={() => setAddSheet(true)} />
        )}
      </div>

      <main style={{ flex: 1, overflowY: "auto", padding: "16px 16px 100px" }}>
        <div key={`content-${tab}-${planningOpen}`} className="fade-in-tab">
          {tab === "budget" && planningOpen && (
            <PlanningScreen
              startingBuffer={startingBuffer}
              scheduledEvents={scheduledEvents}
              onChangeBuffer={setStartingBuffer}
              onDeleteEvent={deleteScheduledEvent}
              onEditEvent={setEditEvent}
            />
          )}
          {tab === "budget" && !planningOpen && (
            <BudgetTab
              view={view}
              incomeItems={incomeItems}
              groups={groups}
              totalPlannedIncome={totalPlannedIncome}
              cashflow={cashflow}
              spentFor={spentFor}
              onDeleteIncome={deleteIncomeItem}
              onDeleteItem={deleteItem}
              onRenameIncome={renameIncomeItem}
              onChangeIncomeAmount={setIncomeItemPlanned}
              onRenameItem={renameItem}
              onChangeItemAmount={setItemPlanned}
              onAddIncome={() => setModal("income")}
              onAddItem={(groupId) => {
                setItemGroupId(groupId);
                setModal("item");
              }}
              onAddGroup={() => setModal("group")}
              onOpenPlanning={() => setPlanningOpen(true)}
              onScheduleIncome={(item) => openSchedule({ refId: item.id, name: item.name, planned: item.planned, type: "income" })}
              onScheduleItem={(groupId, item) => openSchedule({ refId: item.id, name: item.name, planned: item.planned, type: "expense", groupId })}
            />
          )}
          {tab === "today" && (
            <TodayTab
              totalReceivedIncome={totalReceivedIncome}
              totalSpent={totalSpent}
              transactions={transactions}
            />
          )}
          {tab === "transactions" && (
            <TransactionsTab
              transactions={transactions}
              incomeItems={incomeItems}
              allItems={allItems}
              onDelete={deleteTransaction}
            />
          )}
          {tab === "goals" && (
            <GoalsTab goals={goals} onAdd={() => setModal("goal")} onUpdate={updateGoalSaved} onDelete={deleteGoal} />
          )}
          {tab === "insights" && (
            <InsightsTab groups={groups} spentFor={spentFor} totalSpent={totalSpent} />
          )}
        </div>
      </main>

      <BottomNav tab={tab} setTab={setTab} />

      {addSheet && (
        <AddSheet
          onClose={() => setAddSheet(false)}
          onPick={(m) => {
            setAddSheet(false);
            setModal(m);
          }}
        />
      )}
      {modal === "income" && <IncomeModal onClose={() => setModal(null)} onSave={addIncomeItem} />}
      {modal === "group" && <GroupModal onClose={() => setModal(null)} onSave={addGroup} />}
      {modal === "item" && (
        <ItemModal
          groups={groups}
          initialGroupId={itemGroupId}
          onClose={() => { setModal(null); setItemGroupId(null); }}
          onSave={addItemToGroup}
        />
      )}
      {modal === "goal" && <GoalModal onClose={() => setModal(null)} onSave={addGoal} />}
      {modal === "transaction" && (
        <TransactionModal
          incomeItems={incomeItems}
          groups={groups}
          onClose={() => setModal(null)}
          onSave={addTransaction}
        />
      )}
      {modal === "schedule" && scheduleTarget && (
        <ScheduleModal
          target={scheduleTarget}
          onClose={() => { setModal(null); setScheduleTarget(null); }}
          onSave={(events) => { addScheduledEvents(events); setModal(null); setScheduleTarget(null); }}
        />
      )}
      {editEvent && (
        <EditScheduleEventModal
          event={editEvent}
          onClose={() => setEditEvent(null)}
          onSave={(patch) => { updateScheduledEvent(editEvent.id, patch); setEditEvent(null); }}
          onDelete={(id) => { deleteScheduledEvent(id); setEditEvent(null); }}
        />
      )}
    </div>
  );
}

function tabTitle(tab) {
  return { today: "Today", transactions: "Transactions", goals: "Savings Goals", insights: "Insights" }[tab] || "";
}

// ---------------- Header (Budget tab, colored, signature element) ----------------
function BudgetHeader({ view, setView, onAdd }) {
  return (
    <header style={{ background: `linear-gradient(180deg, ${HEADER} 0%, ${HEADER_DARK} 100%)`, padding: "22px 18px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#fff", fontFamily: FONT_DISPLAY }}>
          <span style={{ fontSize: 27, fontWeight: 600 }}>{monthLabel()}</span>
          <span style={{ fontSize: 27, fontWeight: 500, opacity: 0.8 }}>{yearLabel()}</span>
          <ChevronDown size={20} style={{ opacity: 0.8, marginLeft: 2 }} />
        </div>
        <div style={{ display: "flex", gap: 18, color: "#fff" }}>
          <ArrowUpDown size={20} style={{ opacity: 0.85 }} />
          <button onClick={onAdd} aria-label="Add" style={{ background: "none", border: "none", color: "#fff", padding: 0, display: "flex" }}>
            <Plus size={24} />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", background: "rgba(255,255,255,0.14)", borderRadius: 10, padding: 4, marginTop: 18 }}>
        {["planned", "spent", "remaining"].map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 7,
              border: "none",
              background: view === v ? "rgba(255,255,255,0.22)" : "transparent",
              color: "#fff",
              fontSize: 14,
              fontWeight: view === v ? 700 : 500,
              textTransform: "capitalize",
            }}
          >
            {v}
          </button>
        ))}
      </div>
    </header>
  );
}

function SimpleHeader({ title, onAdd }) {
  const showAdd = title === "Savings Goals";
  return (
    <header style={{ background: CARD, padding: "22px 18px 16px", borderBottom: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: INK, fontFamily: FONT_DISPLAY }}>{title}</h1>
      {showAdd && (
        <button onClick={onAdd} aria-label="Add" style={{ background: HEADER, border: "none", color: "#fff", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Plus size={18} />
        </button>
      )}
    </header>
  );
}

// ---------------- Budget tab ----------------
function BudgetTab({
  view, incomeItems, groups,
  totalPlannedIncome, cashflow,
  spentFor, onDeleteIncome, onDeleteItem, onRenameIncome, onChangeIncomeAmount,
  onRenameItem, onChangeItemAmount, onAddIncome, onAddItem, onAddGroup,
  onOpenPlanning, onScheduleIncome, onScheduleItem,
}) {
  const over = cashflow < 0;
  const statusColor = cashflow === 0 ? GREEN : over ? RED : GREEN;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
        <span style={{ fontSize: 20, fontFamily: FONT_DISPLAY, fontWeight: 500 }}>
          {cashflow !== 0 && <strong style={{ color: statusColor, fontWeight: 600 }}>{fmt(Math.abs(cashflow))} </strong>}
          <span style={{ color: MUTED }}>{cashflow === 0 ? "Budget is balanced" : over ? "over budget" : "left to budget"}</span>
        </span>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <SummaryCard label="Planned Income" value={fmt(totalPlannedIncome)} icon={<Wallet size={20} color={HEADER} />} />
        <SummaryCard
          label="Monthly Cashflow"
          value={fmt(cashflow)}
          valueColor={cashflow < 0 ? RED : GREEN}
          icon={<BarChart3 size={20} color={HEADER} />}
          action={{ label: "Paycheck Planning", onClick: onOpenPlanning }}
        />
      </div>

      <LineItemSection
        title="Income"
        items={incomeItems.map((i) => ({ id: i.id, name: i.name, planned: i.planned, spent: spentFor(i.id, "income") }))}
        view={view}
        onAdd={onAddIncome}
        addLabel="Add Income"
        onDelete={onDeleteIncome}
        onRename={onRenameIncome}
        onChangeAmount={onChangeIncomeAmount}
        onSchedule={(itemId, item) => onScheduleIncome(item)}
      />

      {groups.map((g) => (
        <LineItemSection
          key={g.id}
          title={g.name}
          items={g.items.map((it) => ({ id: it.id, name: it.name, planned: it.planned, spent: spentFor(it.id, "expense") }))}
          view={view}
          onAdd={() => onAddItem(g.id)}
          addLabel={g.name === "Debt" ? "Add Debt" : "Add Item"}
          onDelete={(itemId) => onDeleteItem(g.id, itemId)}
          onRename={(itemId, name) => onRenameItem(g.id, itemId, name)}
          onChangeAmount={(itemId, planned) => onChangeItemAmount(g.id, itemId, planned)}
          onSchedule={(itemId, item) => onScheduleItem(g.id, item)}
          overCheck
        />
      ))}
    </div>
  );
}

function SummaryCard({ label, value, valueColor, icon, action }) {
  return (
    <div style={{ flex: 1, background: CARD, borderRadius: 12, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#CFE7F4", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
        {icon}
      </div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: valueColor || INK }}>{value}</div>
      {action && (
        <button
          onClick={action.onClick}
          style={{ marginTop: 8, width: "100%", padding: "6px 0", background: "none", border: `1.5px solid ${HEADER}`, color: HEADER, borderRadius: 7, fontSize: 12, fontWeight: 700 }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Click-to-edit field: shows plain text/number until clicked, then becomes an input.
// No transition/animation — the swap is instant.
function InlineEditable({ value, onCommit, type = "text", formatDisplay, editable = true, textStyle, inputStyle }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editable) {
    return <span style={textStyle}>{formatDisplay ? formatDisplay(value) : value}</span>;
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        value={draft}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const v = type === "number" ? parseFloat(draft) || 0 : draft.trim();
          if (v !== "" && v !== null && v !== undefined) onCommit(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        style={inputStyle}
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      style={{ ...textStyle, cursor: "pointer" }}
    >
      {formatDisplay ? formatDisplay(value) : value}
    </span>
  );
}

function LineItemSection({ title, items, view, onAdd, addLabel, onDelete, onRename, onChangeAmount, onSchedule, overCheck }) {
  return (
    <div style={{ background: CARD, borderRadius: 12, padding: "12px 12px 6px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 600, fontFamily: FONT_DISPLAY }}>{title}</span>
        <span style={{ fontSize: 12, color: MUTED, fontWeight: 600, textTransform: "capitalize", alignSelf: "flex-end" }}>{view}</span>
      </div>

      {items.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 12, margin: "6px 0 12px" }}>Nothing here yet.</p>
      ) : (
        items.map((it) => {
          const remaining = it.planned - it.spent;
          const value = view === "planned" ? it.planned : view === "spent" ? it.spent : remaining;
          const isOver = overCheck && remaining < 0;
          return (
            <div key={it.id} style={{ padding: "10px 0", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 8 }}>
              <InlineEditable
                value={it.name}
                editable={!!onRename}
                onCommit={(v) => onRename(it.id, v)}
                textStyle={{ fontSize: 14, flex: 1 }}
                inputStyle={{ fontSize: 16, flex: 1, background: "transparent", border: "none", borderBottom: `1px solid ${HEADER}`, padding: "0 0 1px", color: INK, fontFamily: "inherit" }}
              />
              <InlineEditable
                value={it.planned}
                type="number"
                editable={view === "planned" && !!onChangeAmount}
                onCommit={(v) => onChangeAmount(it.id, v)}
                formatDisplay={() => fmt(value)}
                textStyle={{ fontSize: 15, fontWeight: 700, color: isOver ? RED : INK }}
                inputStyle={{ fontSize: 16, fontWeight: 700, color: INK, background: "transparent", border: "none", borderBottom: `1px solid ${HEADER}`, width: 84, textAlign: "right", padding: "0 0 1px", fontFamily: "inherit" }}
              />
              {onSchedule && (
                <button onClick={() => onSchedule(it.id, it)} aria-label={`Schedule ${it.name}`} style={{ background: "none", border: "none", color: "#7FA8C2", padding: 2, display: "flex" }}>
                  <CalendarClock size={14} />
                </button>
              )}
              <button onClick={() => onDelete(it.id)} aria-label={`Delete ${it.name}`} style={{ background: "none", border: "none", color: "#7FA8C2", padding: 2, display: "flex" }}>
                <Trash2 size={13} />
              </button>
            </div>
          );
        })
      )}

      <button onClick={onAdd} style={{ background: "none", border: "none", color: HEADER, fontSize: 13, fontWeight: 700, padding: "10px 0", textAlign: "left" }}>
        + {addLabel}
      </button>
    </div>
  );
}

// ---------------- Paycheck Planning ----------------
function PlanningHeader({ onBack }) {
  return (
    <header style={{ background: `linear-gradient(180deg, ${HEADER} 0%, ${HEADER_DARK} 100%)`, padding: "22px 18px 20px", display: "flex", alignItems: "center", position: "relative" }}>
      <button onClick={onBack} aria-label="Back" style={{ background: "none", border: "none", color: "#fff", padding: 0, display: "flex", position: "absolute" }}>
        <ArrowLeft size={22} />
      </button>
      <h1 style={{ margin: "0 auto", fontSize: 19, fontWeight: 700, color: "#fff", fontFamily: FONT_DISPLAY }}>Paycheck Planning</h1>
    </header>
  );
}

function dateParts(iso) {
  const d = new Date(iso + "T00:00:00");
  return { month: d.toLocaleString(undefined, { month: "short" }), day: d.getDate() };
}

function firstOfMonth() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function PlanningScreen({ startingBuffer, scheduledEvents, onChangeBuffer, onDeleteEvent, onEditEvent }) {
  const sorted = [...scheduledEvents].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let running = startingBuffer;
  const rows = sorted.map((e) => {
    running += e.type === "income" ? e.amount : -e.amount;
    return { ...e, balance: running };
  });
  const maxBalance = Math.max(startingBuffer, ...rows.map((r) => r.balance), 1);
  const minBalance = Math.min(startingBuffer, ...rows.map((r) => r.balance));
  const risk = minBalance < 0;
  const today = todayStr();
  const todayIdx = rows.findIndex((r) => r.date > today);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: risk ? RISK_BG : OK_BG, borderRadius: 12, padding: "12px 14px" }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: risk ? RISK_ICON_BG : OK_ICON_BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {risk ? <AlertTriangle size={17} color={RED} /> : <CheckCircle2 size={17} color={GREEN} />}
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>
          {risk ? "High Risk of Overspending" : "On Track"}
        </span>
      </div>

      <div style={{ background: CARD, borderRadius: 14, padding: "14px 14px 6px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, padding: "0 2px" }}>
          <span style={{ fontSize: 15, fontWeight: 600, fontFamily: FONT_DISPLAY }}>Spending Schedule</span>
          <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>Balance</span>
        </div>

        {/* Starting buffer row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 2px", borderBottom: `1px solid ${LINE}` }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: BUFFER_BOX, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ArrowLeft size={15} color={MUTED} style={{ transform: "rotate(180deg)" }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>Starting Buffer</span>
          <InlineEditable
            value={startingBuffer}
            type="number"
            onCommit={onChangeBuffer}
            formatDisplay={(v) => fmt(v)}
            textStyle={{ fontSize: 16, fontWeight: 800, color: INK }}
            inputStyle={{ fontSize: 16, fontWeight: 800, color: INK, background: "transparent", border: "none", borderBottom: `1px solid ${HEADER}`, width: 90, textAlign: "right", padding: "0 0 1px", fontFamily: "inherit" }}
          />
        </div>

        {rows.length === 0 ? (
          <p style={{ color: MUTED, fontSize: 12, margin: "14px 2px 16px" }}>
            Nothing scheduled yet. Go to Budget and tap the calendar icon on any item to schedule it.
          </p>
        ) : (
          rows.map((r, i) => (
            <React.Fragment key={r.id}>
              {i === todayIdx && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 2px" }}>
                  <div style={{ flex: 1, height: 1, background: LINE }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 0.6 }}>TODAY</span>
                  <div style={{ flex: 1, height: 1, background: LINE }} />
                </div>
              )}
              <ScheduleRow row={r} maxBalance={maxBalance} onDelete={onDeleteEvent} onEdit={onEditEvent} />
            </React.Fragment>
          ))
        )}
      </div>
    </div>
  );
}

function ScheduleRow({ row, maxBalance, onDelete, onEdit }) {
  const { month, day } = dateParts(row.date);
  const isIncome = row.type === "income";
  const fillPct = Math.max(6, Math.min(100, (row.balance / maxBalance) * 100));
  const fillColor = row.balance < 0 ? FILL_RISK : isIncome ? FILL_BLUE : "transparent";

  return (
    <div
      onClick={() => onEdit(row)}
      role="button"
      tabIndex={0}
      style={{ position: "relative", borderBottom: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden", margin: "3px 0", cursor: "pointer" }}
    >
      {fillColor !== "transparent" ? (
        <div style={{ position: "absolute", inset: 0, width: `${fillPct}%`, background: fillColor, borderRadius: 10, transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }} />
      ) : (
        <div style={{ position: "absolute", left: 0, top: 4, bottom: 4, width: 3, background: row.balance < 0 ? RED : "#8FBBD6", borderRadius: 2 }} />
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "10px 10px" }}>
        <div style={{ width: 34, flexShrink: 0, textAlign: "center", lineHeight: 1.1 }}>
          <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{month}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{day}</div>
        </div>
        {isIncome && (
          <div style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <CreditCard size={13} color={HEADER} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</div>
          {row.total > 1 && <div style={{ fontSize: 11, color: MUTED }}>{row.index} of {row.total}</div>}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: isIncome ? GREEN : RED }}>
            {isIncome ? "+" : "−"}{fmt(row.amount)}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>{fmt(row.balance)}</div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(row.id); }}
          aria-label={`Remove ${row.name}`}
          style={{ background: "none", border: "none", color: "#7FA8C2", padding: 2, display: "flex", flexShrink: 0 }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// Schedule a budget item across one or more dates. The item's planned budget
// amount is the fixed cap — "Split Evenly" divides it across chosen dates,
// "Custom Amounts" lets you set each date's amount with a running countdown
// so you can't go over (or leave money unallocated).
function ScheduleModal({ target, onClose, onSave }) {
  const cap = target.planned || 0;
  const [mode, setMode] = useState("auto");
  const [dates, setDates] = useState([firstOfMonth()]);
  const [customRows, setCustomRows] = useState([{ id: uid(), date: firstOfMonth(), amount: "" }]);

  const addDate = () => setDates((d) => [...d, firstOfMonth()]);
  const updateDate = (i, v) => setDates((d) => d.map((x, idx) => (idx === i ? v : x)));
  const removeDate = (i) => setDates((d) => d.filter((_, idx) => idx !== i));

  const splitBase = dates.length ? round2(cap / dates.length) : 0;
  const splitAmounts = dates.map((_, i) =>
    i < dates.length - 1 ? splitBase : round2(cap - splitBase * (dates.length - 1))
  );

  const addCustomRow = () => setCustomRows((r) => [...r, { id: uid(), date: firstOfMonth(), amount: "" }]);
  const updateCustomRow = (id, field, v) =>
    setCustomRows((r) => r.map((row) => (row.id === id ? { ...row, [field]: v } : row)));
  const removeCustomRow = (id) => setCustomRows((r) => r.filter((row) => row.id !== id));

  const customTotal = round2(customRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0));
  const remaining = round2(cap - customTotal);
  const isBalanced = Math.abs(remaining) < 0.005 && customRows.length > 0;

  const submitAuto = () => {
    if (dates.length === 0 || cap <= 0) return;
    const events = dates.map((d, i) => ({
      id: uid(), refId: target.refId, groupId: target.groupId || null, type: target.type,
      name: target.name, amount: splitAmounts[i], date: d, index: i + 1, total: dates.length,
    }));
    onSave(events);
  };

  const submitCustom = () => {
    if (!isBalanced) return;
    const events = customRows.map((r, i) => ({
      id: uid(), refId: target.refId, groupId: target.groupId || null, type: target.type,
      name: target.name, amount: parseFloat(r.amount) || 0, date: r.date, index: i + 1, total: customRows.length,
    }));
    onSave(events);
  };

  return (
    <SheetShell title={`Schedule "${target.name}"`} onClose={onClose}>
      <div style={{ background: BG, borderRadius: 8, padding: "10px 12px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>Budgeted amount</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: INK }}>{fmt(cap)}</span>
      </div>

      {cap <= 0 ? (
        <p style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>
          This item has no planned amount yet. Set one on the Budget tab first, then come back to schedule it.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setMode("auto")}
              style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${mode === "auto" ? HEADER : LINE}`, background: mode === "auto" ? "#EDEEF6" : "transparent", color: mode === "auto" ? HEADER : MUTED, fontSize: 13, fontWeight: 700 }}
            >
              Split Evenly
            </button>
            <button
              onClick={() => setMode("custom")}
              style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${mode === "custom" ? HEADER : LINE}`, background: mode === "custom" ? "#EDEEF6" : "transparent", color: mode === "custom" ? HEADER : MUTED, fontSize: 13, fontWeight: 700 }}
            >
              Custom Amounts
            </button>
          </div>

          {mode === "auto" && (
            <>
              {dates.map((d, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <input type="date" value={d} onChange={(e) => updateDate(i, e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: HEADER, width: 68, textAlign: "right", flexShrink: 0 }}>{fmt(splitAmounts[i])}</span>
                  {dates.length > 1 && (
                    <button onClick={() => removeDate(i)} aria-label="Remove date" style={{ background: "none", border: "none", color: "#7FA8C2", flexShrink: 0 }}>
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addDate} style={{ background: "none", border: "none", color: HEADER, fontSize: 13, fontWeight: 700, padding: "6px 0 14px", textAlign: "left" }}>
                + Add another date
              </button>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>
                {dates.length} date{dates.length > 1 ? "s" : ""} · {fmt(splitAmounts[0] || 0)} each · {fmt(cap)} total
              </div>
              <button style={bigSaveBtnStyle} onClick={submitAuto}>Add to Schedule</button>
            </>
          )}

          {mode === "custom" && (
            <>
              {customRows.map((r) => (
                <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <input type="date" value={r.date} onChange={(e) => updateCustomRow(r.id, "date", e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
                  <input type="number" inputMode="decimal" placeholder="0.00" value={r.amount} onChange={(e) => updateCustomRow(r.id, "amount", e.target.value)} style={{ ...inputStyle, marginBottom: 0, width: 84, textAlign: "right" }} />
                  {customRows.length > 1 && (
                    <button onClick={() => removeCustomRow(r.id)} aria-label="Remove date" style={{ background: "none", border: "none", color: "#7FA8C2", flexShrink: 0 }}>
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addCustomRow} style={{ background: "none", border: "none", color: HEADER, fontSize: 13, fontWeight: 700, padding: "6px 0 14px", textAlign: "left" }}>
                + Add another date
              </button>
              <div style={{ background: isBalanced ? "#EAF3EC" : remaining < 0 ? "#F7EAE7" : BG, borderRadius: 8, padding: "10px 12px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: isBalanced ? GREEN : remaining < 0 ? RED : MUTED }}>
                  {isBalanced ? "Fully allocated" : remaining < 0 ? "Over budget by" : "Left to allocate"}
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: isBalanced ? GREEN : remaining < 0 ? RED : INK }}>
                  {isBalanced ? fmt(cap) : fmt(Math.abs(remaining))}
                </span>
              </div>
              <button style={{ ...bigSaveBtnStyle, opacity: isBalanced ? 1 : 0.5 }} disabled={!isBalanced} onClick={submitCustom}>
                Add to Schedule
              </button>
            </>
          )}
        </>
      )}
    </SheetShell>
  );
}

function EditScheduleEventModal({ event, onClose, onSave, onDelete }) {
  const [date, setDate] = useState(event.date);
  const [amount, setAmount] = useState(event.amount);

  const submit = () => {
    const amt = parseFloat(amount);
    if (!amt || !date) return;
    onSave({ date, amount: amt });
  };

  return (
    <SheetShell title={`Edit "${event.name}"`} onClose={onClose}>
      {event.total > 1 && (
        <p style={{ fontSize: 12, color: MUTED, marginTop: -6, marginBottom: 14 }}>
          Part {event.index} of {event.total} scheduled dates for this item.
        </p>
      )}
      <label style={labelStyle}>Date</label>
      <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      <label style={labelStyle}>Amount</label>
      <input style={inputStyle} type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />

      <button style={bigSaveBtnStyle} onClick={submit}>Save changes</button>
      <button
        onClick={() => onDelete(event.id)}
        style={{ width: "100%", padding: "12px 0", background: "none", border: "none", color: RED, fontSize: 14, fontWeight: 700, marginTop: 10 }}
      >
        Remove from schedule
      </button>
    </SheetShell>
  );
}

// ---------------- Today tab ----------------
function TodayTab({ totalReceivedIncome, totalSpent, transactions }) {
  const balance = totalReceivedIncome - totalSpent;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: CARD, borderRadius: 12, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Current balance</div>
        <div style={{ fontSize: 26, fontWeight: 800 }}>{fmt(balance)}</div>
        <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 12 }}>
          <span style={{ color: GREEN }}>Received {fmt(totalReceivedIncome)}</span>
          <span style={{ color: RED }}>Spent {fmt(totalSpent)}</span>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>Recent activity</div>
        {transactions.length === 0 ? (
          <div style={{ background: CARD, borderRadius: 12, padding: 14, color: MUTED, fontSize: 12 }}>
            No transactions logged yet.
          </div>
        ) : (
          <div style={{ background: CARD, borderRadius: 12, padding: "2px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            {transactions.slice(0, 6).map((t, i, arr) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: i < arr.length - 1 ? `1px solid ${LINE}` : "none" }}>
                <div>
                  <div style={{ fontSize: 14 }}>{t.note || (t.type === "income" ? "Income" : "Expense")}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{t.date}</div>
                </div>
                <span style={{ fontWeight: 700, color: t.type === "income" ? GREEN : RED }}>
                  {t.type === "income" ? "+" : "−"}{fmt(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Transactions tab ----------------
function TransactionsTab({ transactions, incomeItems, allItems, onDelete }) {
  const nameFor = (t) => {
    if (t.type === "income") return incomeItems.find((i) => i.id === t.refId)?.name || "Income";
    return allItems.find((i) => i.id === t.refId)?.name || "Expense";
  };
  if (transactions.length === 0) {
    return <div style={{ background: CARD, borderRadius: 12, padding: 14, color: MUTED, fontSize: 12 }}>No transactions yet.</div>;
  }
  return (
    <div style={{ background: CARD, borderRadius: 12, padding: "2px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      {transactions.map((t, i, arr) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 0", borderBottom: i < arr.length - 1 ? `1px solid ${LINE}` : "none" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14 }}>{t.note || nameFor(t)}</div>
            <div style={{ fontSize: 11, color: MUTED }}>{nameFor(t)} · {t.date}</div>
          </div>
          <span style={{ fontWeight: 700, color: t.type === "income" ? GREEN : RED }}>
            {t.type === "income" ? "+" : "−"}{fmt(t.amount)}
          </span>
          <button onClick={() => onDelete(t.id)} aria-label="Delete transaction" style={{ background: "none", border: "none", color: "#C9C4B8" }}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------- Goals tab ----------------
function GoalsTab({ goals, onAdd, onUpdate, onDelete }) {
  if (goals.length === 0) {
    return (
      <div style={{ background: CARD, borderRadius: 12, padding: 14, color: MUTED, fontSize: 12 }}>
        No savings goals yet. Tap + above to add one.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {goals.map((g) => {
        const pct = Math.min(100, (g.saved / g.target) * 100);
        return (
          <div key={g.id} style={{ background: CARD, borderRadius: 12, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{g.name}</span>
              <button onClick={() => onDelete(g.id)} aria-label="Delete goal" style={{ background: "none", border: "none", color: "#7FA8C2" }}>
                <Trash2 size={13} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 5 }}>{fmt(g.saved)} of {fmt(g.target)} · {pct.toFixed(0)}%</div>
            <div style={{ height: 6, background: LINE, borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
              <div style={{ width: `${pct}%`, height: "100%", background: GREEN, transition: "width 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => onUpdate(g.id, 25)} style={{ flex: 1, background: "#EAF3EC", border: "none", borderRadius: 7, padding: "7px 0", color: GREEN, fontWeight: 700, fontSize: 12 }}>+ $25</button>
              <button onClick={() => onUpdate(g.id, 100)} style={{ flex: 1, background: "#EAF3EC", border: "none", borderRadius: 7, padding: "7px 0", color: GREEN, fontWeight: 700, fontSize: 12 }}>+ $100</button>
              <button onClick={() => onUpdate(g.id, -25)} style={{ flex: 1, background: "#F7EAE7", border: "none", borderRadius: 7, padding: "7px 0", color: RED, fontWeight: 700, fontSize: 12 }}>− $25</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Insights tab ----------------
function InsightsTab({ groups, spentFor, totalSpent }) {
  const allItems = groups.flatMap((g) => g.items);
  if (allItems.length === 0) {
    return <div style={{ background: CARD, borderRadius: 12, padding: 14, color: MUTED, fontSize: 12 }}>Add budget items to see spending insights.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {groups.map((g) => {
        const groupSpent = g.items.reduce((s, it) => s + spentFor(it.id, "expense"), 0);
        if (g.items.length === 0) return null;
        const pct = totalSpent > 0 ? (groupSpent / totalSpent) * 100 : 0;
        return (
          <div key={g.id} style={{ background: CARD, borderRadius: 12, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5, fontWeight: 700 }}>
              <span>{g.name}</span>
              <span style={{ color: MUTED, fontWeight: 500 }}>{fmt(groupSpent)} · {pct.toFixed(0)}%</span>
            </div>
            <div style={{ height: 6, background: LINE, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: HEADER, transition: "width 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Bottom nav ----------------
function BottomNav({ tab, setTab }) {
  const items = [
    { id: "today", label: "Today", icon: Home },
    { id: "budget", label: "Budget", icon: Wallet },
    { id: "transactions", label: "Transactions", icon: Receipt },
    { id: "goals", label: "Goals", icon: PiggyBank },
    { id: "insights", label: "Insights", icon: BarChart3 },
  ];
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: CARD, borderTop: `1px solid ${LINE}`, display: "flex", padding: "9px 4px calc(9px + env(safe-area-inset-bottom))" }}>
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setTab(id)}
          style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: tab === id ? HEADER : "#B3ADA0" }}
        >
          <Icon size={20} />
          <span style={{ fontSize: 10, fontWeight: tab === id ? 700 : 500 }}>{label}</span>
        </button>
      ))}
    </nav>
  );
}

// ---------------- Add sheet + modals ----------------
function SheetShell({ title, onClose, children }) {
  const [closing, setClosing] = useState(false);
  const requestClose = () => {
    setClosing(true);
    setTimeout(onClose, 200);
  };
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(20,24,40,0.55)", display: "flex", alignItems: "flex-end", zIndex: 50,
        animation: `${closing ? "backdropOut" : "backdropIn"} 0.2s ease forwards`,
      }}
      onClick={requestClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: CARD, width: "100%", borderRadius: "18px 18px 0 0", padding: "20px 20px calc(20px + env(safe-area-inset-bottom))", maxHeight: "85vh", overflowY: "auto",
          animation: `${closing ? "sheetOut" : "sheetIn"} 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{title}</h2>
          <button onClick={requestClose} aria-label="Close" style={{ background: "none", border: "none", color: MUTED }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddSheet({ onClose, onPick }) {
  const opts = [
    { id: "transaction", label: "Log a transaction" },
    { id: "income", label: "Add income line" },
    { id: "group", label: "Add budget category" },
    { id: "goal", label: "Add savings goal" },
  ];
  return (
    <SheetShell title="What do you want to add?" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {opts.map((o) => (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            style={{ textAlign: "left", padding: "14px 16px", background: BG, border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, color: INK }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </SheetShell>
  );
}

const inputStyle = { width: "100%", background: BG, border: `1px solid ${LINE}`, borderRadius: 8, padding: "10px 12px", fontSize: 16, color: INK, marginBottom: 12, fontFamily: FONT_BODY };
const labelStyle = { fontSize: 11, color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 };
const saveBtnStyle = { width: "100%", padding: "13px 0", background: HEADER, border: "none", borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 700, marginTop: 4 };
const bigSaveBtnStyle = { width: "100%", padding: "17px 0", background: HEADER, border: "none", borderRadius: 12, color: "#fff", fontSize: 17, fontWeight: 800, marginTop: 6, boxShadow: "0 2px 8px rgba(51,64,110,0.25)" };

function IncomeModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [planned, setPlanned] = useState("");
  const submit = () => {
    const p = parseFloat(planned);
    if (!name.trim() || !p) return;
    onSave({ name: name.trim(), planned: p });
  };
  return (
    <SheetShell title="Add income" onClose={onClose}>
      <label style={labelStyle}>Source name</label>
      <input style={inputStyle} placeholder="e.g. Paycheck 1" value={name} onChange={(e) => setName(e.target.value)} />
      <label style={labelStyle}>Planned amount</label>
      <input style={inputStyle} type="number" inputMode="decimal" placeholder="0.00" value={planned} onChange={(e) => setPlanned(e.target.value)} />
      <button style={saveBtnStyle} onClick={submit}>Save income</button>
    </SheetShell>
  );
}

function GroupModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const submit = () => {
    if (!name.trim()) return;
    onSave(name.trim());
  };
  return (
    <SheetShell title="Add budget category" onClose={onClose}>
      <label style={labelStyle}>Category name</label>
      <input style={inputStyle} placeholder="e.g. Subscriptions" value={name} onChange={(e) => setName(e.target.value)} />
      <button style={saveBtnStyle} onClick={submit}>Save category</button>
    </SheetShell>
  );
}

function ItemModal({ groups, initialGroupId, onClose, onSave }) {
  const [groupId, setGroupId] = useState(initialGroupId || groups[0]?.id || "");
  const [name, setName] = useState("");
  const [planned, setPlanned] = useState("");
  const submit = () => {
    const p = parseFloat(planned) || 0;
    if (!name.trim() || !groupId) return;
    onSave(groupId, { name: name.trim(), planned: p });
  };
  return (
    <SheetShell title="Add item" onClose={onClose}>
      <label style={labelStyle}>Category</label>
      <select style={inputStyle} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
      <label style={labelStyle}>Item name</label>
      <input style={inputStyle} placeholder="e.g. Netflix" value={name} onChange={(e) => setName(e.target.value)} />
      <label style={labelStyle}>Planned amount</label>
      <input style={inputStyle} type="number" inputMode="decimal" placeholder="0.00" value={planned} onChange={(e) => setPlanned(e.target.value)} />
      <button style={saveBtnStyle} onClick={submit}>Save item</button>
    </SheetShell>
  );
}

function GoalModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const submit = () => {
    const t = parseFloat(target);
    if (!name.trim() || !t) return;
    onSave({ name: name.trim(), target: t });
  };
  return (
    <SheetShell title="Add savings goal" onClose={onClose}>
      <label style={labelStyle}>Goal name</label>
      <input style={inputStyle} placeholder="e.g. Emergency fund" value={name} onChange={(e) => setName(e.target.value)} />
      <label style={labelStyle}>Target amount</label>
      <input style={inputStyle} type="number" inputMode="decimal" placeholder="0.00" value={target} onChange={(e) => setTarget(e.target.value)} />
      <button style={saveBtnStyle} onClick={submit}>Save goal</button>
    </SheetShell>
  );
}

function TransactionModal({ incomeItems, groups, onClose, onSave }) {
  const [type, setType] = useState("expense");
  const allItems = groups.flatMap((g) => g.items.map((it) => ({ ...it, groupName: g.name })));
  const options = type === "income" ? incomeItems : allItems;
  const [refId, setRefId] = useState(options[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr());

  useEffect(() => {
    const opts = type === "income" ? incomeItems : allItems;
    setRefId(opts[0]?.id || "");
  }, [type]);

  const submit = () => {
    const amt = parseFloat(amount);
    if (!amt || !refId) return;
    onSave({ type, refId, amount: amt, note, date });
  };

  return (
    <SheetShell title="Log a transaction" onClose={onClose}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["expense", "income"].map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 8,
              border: `1px solid ${type === t ? HEADER : LINE}`,
              background: type === t ? "#EDEEF6" : "transparent",
              color: type === t ? HEADER : MUTED, fontSize: 13, fontWeight: 700, textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <label style={labelStyle}>{type === "income" ? "Income source" : "Budget item"}</label>
      {options.length === 0 ? (
        <p style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
          {type === "income" ? "Add an income line first." : "Add a budget item first."}
        </p>
      ) : type === "income" ? (
        <select style={inputStyle} value={refId} onChange={(e) => setRefId(e.target.value)}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      ) : (
        <select style={inputStyle} value={refId} onChange={(e) => setRefId(e.target.value)}>
          {groups.map((g) => (
            <optgroup key={g.id} label={g.name}>
              {g.items.map((it) => (
                <option key={it.id} value={it.id}>{it.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      )}

      <label style={labelStyle}>Amount</label>
      <input style={inputStyle} type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />

      <label style={labelStyle}>Note (optional)</label>
      <input style={inputStyle} placeholder="e.g. Publix run" value={note} onChange={(e) => setNote(e.target.value)} />

      <label style={labelStyle}>Date</label>
      <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      <button style={saveBtnStyle} onClick={submit} disabled={options.length === 0}>Save transaction</button>
    </SheetShell>
  );
}
