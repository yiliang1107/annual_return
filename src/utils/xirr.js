// src/utils/xirr.js

// cashflows: [{ date: Date, amount: number }, ...]
export function xirr(cashflows, guess = 0.1, maxIter = 100, tol = 1e-7) {
    if (!Array.isArray(cashflows) || cashflows.length < 2) return null;
  
    const hasPositive = cashflows.some((cf) => cf.amount > 0);
    const hasNegative = cashflows.some((cf) => cf.amount < 0);
    if (!hasPositive || !hasNegative) {
      // 必須同時有正、負現金流才有 IRR 意義
      return null;
    }
  
    let rate = guess;
  
    for (let i = 0; i < maxIter; i++) {
      const t0 = cashflows[0].date.getTime();
  
      let f = 0; // NPV
      let fPrime = 0; // NPV 對 rate 的導數
  
      for (const cf of cashflows) {
        const days = (cf.date.getTime() - t0) / (1000 * 60 * 60 * 24);
        const yearFraction = days / 365;
        const base = 1 + rate;
        const denom = Math.pow(base, yearFraction);
  
        f += cf.amount / denom;
        // d/d(rate) [CF / (1+rate)^t] = CF * (-t) / (1+rate)^(t+1)
        fPrime += (-yearFraction) * cf.amount / (denom * base);
      }
  
      if (Math.abs(fPrime) < 1e-12) {
        // 斜率太小，避免除以 0
        break;
      }
  
      const newRate = rate - f / fPrime;
  
      if (Math.abs(newRate - rate) < tol) {
        return newRate;
      }
  
      rate = newRate;
    }
  
    // 沒收斂就回 null
    return null;
  }
  