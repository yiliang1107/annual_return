import { useState } from "react";
import { xirr } from "./utils/xirr";
import "./App.css";

// 輔助函式：加上千分位逗號
const formatNumber = (val) => {
  if (!val) return "";
  // 先移除舊的逗號，避免重複
  const str = val.toString().replace(/,/g, "");
  // 處理小數點
  const parts = str.split(".");
  // 整數部分加逗號
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

// 輔助函式：移除逗號 (用於存回 state)
const parseNumber = (val) => {
  return val.replace(/,/g, "");
};

function App() {
  // 多筆紀錄：新增 name (名目) 與 type (out=投入/give, in=取回/take)
  const [investItems, setInvestItems] = useState([
    { id: 1, name: "初始資金", type: "out", amount: "100000", date: "2023-01-01" },
  ]);

  // 結算資訊
  const [finalAmount, setFinalAmount] = useState("158000");
  const [finalDate, setFinalDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // 新增一筆紀錄
  const addInvestItem = () => {
    setInvestItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: "",       // 預設名目空白
        type: "out",    // 預設為投入
        amount: "",
        date: "",
      },
    ]);
  };

  // 更新某一筆紀錄
  const updateInvestItem = (id, field, value) => {
    setInvestItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  // 專門處理金額變更 (移除逗號後再儲存)
  const handleAmountChange = (id, rawValue) => {
    // 限制只能輸入數字、小數點和逗號
    const validValue = rawValue.replace(/[^0-9.,]/g, "");
    const cleanValue = parseNumber(validValue);
    updateInvestItem(id, "amount", cleanValue);
  };

  // 專門處理結算金額變更
  const handleFinalAmountChange = (rawValue) => {
    const validValue = rawValue.replace(/[^0-9.,]/g, "");
    setFinalAmount(parseNumber(validValue));
  };

  // 刪除某一筆紀錄
  const removeInvestItem = (id) => {
    setInvestItems((prev) => {
      if (prev.length === 1) {
        // 只剩一筆時，清空內容回歸預設
        return [{ ...prev[0], name: "", type: "out", amount: "", date: "" }];
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  // 按下計算
  const handleCalculate = () => {
    setError(null);
    setResult(null);

    const cashflows = [];

    // 整理現金流
    for (const item of investItems) {
      const amt = Number(item.amount);

      // 完全空白的列就跳過
      if (!item.amount && !item.date) continue;

      if (!item.date || isNaN(amt) || amt <= 0) {
        setError("請確認每一筆紀錄都有「正確金額（需大於 0）」與「日期」。");
        return;
      }

      const d = new Date(item.date);
      if (isNaN(d.getTime())) {
        setError("有一筆紀錄的日期格式有誤，請重新選擇。");
        return;
      }

      // 關鍵邏輯：
      // type === "out" (投入/Give) -> 現金流為 負數 (-)
      // type === "in"  (取回/Take) -> 現金流為 正數 (+)
      const flowAmount = item.type === "in" ? amt : -amt;

      cashflows.push({ date: d, amount: flowAmount });
    }

    if (cashflows.length === 0) {
      setError("請至少輸入一筆有效的紀錄。");
      return;
    }

    // 結算金額
    const final = Number(finalAmount);
    if (isNaN(final) || final < 0) {
      setError("請輸入正確的結算時資產價值。");
      return;
    }

    if (!finalDate) {
      setError("請輸入結算日期。");
      return;
    }

    const finalD = new Date(finalDate);
    if (isNaN(finalD.getTime())) {
      setError("結算日期格式有誤，請重新選擇。");
      return;
    }

    // 依日期排序
    cashflows.sort((a, b) => a.date - b.date);

    // 結算日期必須晚於最早的一筆日期
    if (finalD <= cashflows[0].date) {
      setError("結算日期必須晚於最早的一筆紀錄日期。");
      return;
    }

    // 把結算金額加入現金流（正數，視為最後一次全部取回）
    if (final > 0) {
        cashflows.push({ date: finalD, amount: final });
    }

    // 檢查是否有正負現金流
    const hasPositive = cashflows.some(c => c.amount > 0);
    const hasNegative = cashflows.some(c => c.amount < 0);
    
    if (!hasPositive || !hasNegative) {
        setError("無法計算：現金流必須同時包含「投入（負值）」與「回收（正值）」。請確認是否有投入資金以及結算價值。");
        return;
    }

    const r = xirr(cashflows);
    if (r === null || !isFinite(r)) {
      setError("無法計算年化報酬率，請確認輸入數值是否合理（例如日期太近或金額落差過大）。");
      return;
    }

    setResult(r);
  };

  const formatPercent = (value) => (value * 100).toFixed(2) + "%";

  // 總投入金額 (只計算 type === 'out' 的項目)
  const totalInvest = investItems.reduce((sum, item) => {
    const amt = Number(item.amount);
    if (!isNaN(amt) && amt > 0 && item.type === 'out') {
      return sum + amt;
    }
    return sum;
  }, 0);

  // 總取回金額 (計算 type === 'in' 的項目，不含最終結算)
  const totalWithdraw = investItems.reduce((sum, item) => {
    const amt = Number(item.amount);
    if (!isNaN(amt) && amt > 0 && item.type === 'in') {
      return sum + amt;
    }
    return sum;
  }, 0);

  // 總報酬率試算
  const netProfit = (Number(finalAmount) || 0) + totalWithdraw - totalInvest;
  const totalReturn =
    totalInvest > 0
      ? netProfit / totalInvest
      : null;

  // 投資期間
  let years = null;
  if (finalDate) {
    const finalD = new Date(finalDate);
    const validDates = investItems
      .map((item) => new Date(item.date))
      .filter((d) => !isNaN(d.getTime()));

    if (validDates.length > 0 && !isNaN(finalD.getTime())) {
      const earliest = validDates.reduce((min, d) => (d < min ? d : min));
      const days = (finalD.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24);
      years = days / 365;
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#0f172a",
        color: "#e5e7eb",
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: "16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "800px",
          background: "#020617",
          padding: "24px",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)",
          border: "1px solid #1f2937",
        }}
      >
        <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>
          年化報酬率（XIRR）試算
        </h1>
        <p style={{ fontSize: "14px", color: "#9ca3af", marginBottom: "16px" }}>
          請輸入每一筆資金異動（投入或取回），以及最後的結算價值。
        </p>

        {/* 資金異動區塊 */}
        <div
          style={{
            marginBottom: "16px",
            padding: "12px",
            borderRadius: "12px",
            background: "#020617",
            border: "1px solid #111827",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <h2 style={{ fontSize: "16px" }}>資金異動紀錄</h2>
            <button
              type="button"
              onClick={addInvestItem}
              style={{
                fontSize: "12px",
                padding: "4px 10px",
                borderRadius: "999px",
                border: "none",
                background: "linear-gradient(135deg, #38bdf8, #6366f1)",
                color: "#020617",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              ＋ 新增一筆
            </button>
          </div>

          {/* 表頭 (使用 CSS class 控制手機版隱藏) */}
          <div className="invest-header">
             <div>名目 (Left OK)</div>
             <div>類型 (Give/Take)</div>
             <div>金額</div>
             <div>日期</div>
             <div></div>
          </div>

          {investItems.map((item) => (
            <div key={item.id} className="invest-row">
              {/* 名目 Name */}
              <div className="invest-item-name">
                <input
                  type="text"
                  placeholder="名目"
                  value={item.name}
                  onChange={(e) => updateInvestItem(item.id, "name", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    borderRadius: "6px",
                    border: "1px solid #4b5563",
                    background: "#1e293b",
                    color: "#e5e7eb",
                  }}
                />
              </div>

              {/* 類型 Type (Give/Take) */}
              <div className="invest-item-type">
                <select
                  value={item.type}
                  onChange={(e) => updateInvestItem(item.id, "type", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    borderRadius: "6px",
                    border: "1px solid #4b5563",
                    background: item.type === 'out' ? "#1e293b" : "#3f2c2c",
                    color: item.type === 'out' ? "#93c5fd" : "#fca5a5",
                  }}
                >
                  <option value="out">投入</option>
                  <option value="in">取回</option>
                </select>
              </div>

              {/* 金額 Amount */}
              <div className="invest-item-amount">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="金額"
                  value={formatNumber(item.amount)}
                  onChange={(e) => handleAmountChange(item.id, e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    borderRadius: "6px",
                    border: "1px solid #4b5563",
                    background: "#020617",
                    color: "#e5e7eb",
                    textAlign: "right"
                  }}
                />
              </div>

              {/* 日期 Date */}
              <div className="invest-item-date">
                <input
                  type="date"
                  value={item.date}
                  onChange={(e) => updateInvestItem(item.id, "date", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    borderRadius: "6px",
                    border: "1px solid #4b5563",
                    background: "#020617",
                    color: "#e5e7eb",
                  }}
                />
              </div>

              {/* 刪除按鈕 */}
              <div className="invest-item-del" style={{ textAlign: "center" }}>
                <button
                  type="button"
                  onClick={() => removeInvestItem(item.id)}
                  style={{
                    display: "inline-flex",
                    justifyContent: "center",
                    alignItems: "center",
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    border: "1px solid #ef4444",
                    background: "rgba(239, 68, 68, 0.1)",
                    color: "#ef4444",
                    cursor: "pointer",
                    padding: 0,
                  }}
                  title="刪除"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 結算區塊 */}
        <div style={{ marginBottom: "20px", padding: "12px", background: "#1e293b", borderRadius: "12px" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "8px", color: "#94a3b8" }}>最終狀態</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>目前資產總值</label>
              <input
                type="text"
                inputMode="decimal"
                value={formatNumber(finalAmount)}
                onChange={(e) => handleFinalAmountChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #4b5563",
                  background: "#020617",
                  color: "#e5e7eb",
                  fontSize: "16px",
                  fontWeight: "bold",
                  textAlign: "right"
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>結算日期</label>
              <input
                type="date"
                value={finalDate}
                onChange={(e) => setFinalDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #4b5563",
                  background: "#020617",
                  color: "#e5e7eb",
                }}
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleCalculate}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "999px",
            border: "none",
            background: "linear-gradient(135deg, #22c55e, #14b8a6)",
            color: "#020617",
            fontWeight: "bold",
            fontSize: "16px",
            cursor: "pointer",
            marginBottom: "12px",
            boxShadow: "0 4px 12px rgba(34, 197, 94, 0.3)"
          }}
        >
          計算年化報酬率 (Calculate)
        </button>

        {error && (
          <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(239,68,68,0.2)", color: "#fca5a5", fontSize: "14px", marginBottom: "12px" }}>
            {error}
          </div>
        )}

        {/* 結果顯示 */}
        <div
          style={{
            padding: "16px",
            borderRadius: "12px",
            background: "#0f172a",
            border: "1px solid #1e293b",
          }}
        >
          <h2 style={{ fontSize: "16px", marginBottom: "8px", borderBottom: "1px solid #334155", paddingBottom: "4px" }}>
            試算結果
          </h2>
          {result !== null ? (
            <div>
              <div style={{ fontSize: "28px", fontWeight: "bold", color: "#4ade80", marginBottom: "8px" }}>
                {formatPercent(result)} <span style={{ fontSize: "14px", color: "#86efac", fontWeight: "normal" }}>(XIRR)</span>
              </div>
              
              <div style={{ fontSize: "13px", color: "#9ca3af", lineHeight: "1.6" }}>
                <div>總投入成本：<span style={{ color: "#e5e7eb" }}>{totalInvest.toLocaleString()}</span></div>
                {totalWithdraw > 0 && (
                   <div>期間已取回：<span style={{ color: "#e5e7eb" }}>{totalWithdraw.toLocaleString()}</span></div>
                )}
                <div>目前資產值：<span style={{ color: "#e5e7eb" }}>{Number(finalAmount).toLocaleString()}</span></div>
                
                {totalReturn !== null && (
                   <div>總投資報酬率：<span style={{ color: totalReturn >= 0 ? "#fca5a5" : "#86efac" }}>{formatPercent(totalReturn)}</span></div>
                )}
                
                {years !== null && (
                  <div>持有期間：約 {years.toFixed(2)} 年</div>
                )}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: "13px", color: "#6b7280" }}>
              輸入數據後點擊計算，結果將顯示於此。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
