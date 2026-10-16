"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

// Demo values. Replace with your real UPI ID later (from settings / env).
const DEMO_UPI_ID = "demo@upi";
const DEMO_PAYEE_NAME = "Demo Restaurant";

function buildUpiLink(upiId: string, payeeName: string, billId: string, amount: number) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: amount.toFixed(2),
    cu: "INR",
    tn: `Bill ${billId}`,
    tr: billId,
  });
  return `upi://pay?${params.toString()}`;
}

export default function QrDemoPage() {
  const [billId, setBillId] = useState("b2");
  const [amount, setAmount] = useState("704");

  const numericAmount = Number(amount);
  const isValid = billId.trim() !== "" && Number.isFinite(numericAmount) && numericAmount > 0;

  const upiLink = useMemo(
    () => (isValid ? buildUpiLink(DEMO_UPI_ID, DEMO_PAYEE_NAME, billId.trim(), numericAmount) : ""),
    [isValid, billId, numericAmount]
  );

  const gold = "#d4af37";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#050608",
        color: "#e5e5e5",
        fontFamily: "system-ui, sans-serif",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#101118",
          border: `1px solid ${gold}`,
          borderRadius: 20,
          padding: 24,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, color: gold }}>Pay bill #{billId || "-"}</h1>
        <p style={{ margin: "4px 0 20px", fontSize: 14, color: "#8a8d96" }}>Scan to pay</p>

        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <label style={{ flex: 1, fontSize: 13, color: "#8a8d96" }}>
            Bill ID
            <input
              value={billId}
              onChange={(e) => setBillId(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ flex: 1, fontSize: 13, color: "#8a8d96" }}>
            Amount (₹)
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              style={inputStyle}
            />
          </label>
        </div>

        <div
          style={{
            background: "#08090c",
            border: "1px solid #22242c",
            borderRadius: 14,
            padding: 16,
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 13, color: "#8a8d96" }}>Amount to pay</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: gold }}>
            ₹{isValid ? numericAmount : "0"}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          {isValid ? (
            <div style={{ background: "#fff", padding: 12, borderRadius: 12 }}>
              <QRCodeSVG value={upiLink} size={240} level="M" />
            </div>
          ) : (
            <p style={{ color: "#8a8d96", fontSize: 14 }}>
              Enter a bill ID and an amount above 0 to generate the QR.
            </p>
          )}
        </div>

        {isValid && (
          <p style={{ fontSize: 11, color: "#6b6e78", wordBreak: "break-all", margin: 0 }}>
            {upiLink}
          </p>
        )}
        <p style={{ fontSize: 12, color: gold, marginTop: 12, marginBottom: 0 }}>
          Demo only: uses a dummy UPI ID. Add a real restaurant UPI account before accepting payments.
        </p>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "8px 10px",
  background: "#08090c",
  border: "1px solid #2a2c35",
  borderRadius: 8,
  color: "#e5e5e5",
  fontSize: 15,
  boxSizing: "border-box",
};