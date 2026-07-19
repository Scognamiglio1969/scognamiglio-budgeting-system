import { ArrowRight, CircleAlert, Coins, Landmark, ReceiptText, WalletCards } from 'lucide-react';
import { calculateBudgetTotals, calculateIncentives, evaluateBudget, sumEvaluated } from '../engine';
import { accountItems } from '../helpers';
import type { BudgetScenario } from '../types';
import { ViewHeader } from '../components/ui';

interface Props {
  scenario: BudgetScenario;
  money: Intl.NumberFormat;
  onOpenAccount: (accountId: string) => void;
}

export function TopsheetView({ scenario, money, onOpenAccount }: Props) {
  const { data } = scenario;
  const evaluated = evaluateBudget(data);
  const totals = calculateBudgetTotals(data, evaluated);
  const incentiveResults = calculateIncentives(data, evaluated);
  const accountRows = data.accounts.map((account) => {
    const entries = accountItems(data, evaluated, account.id);
    return { account, entries, totals: sumEvaluated(entries) };
  });
  const maxTotal = Math.max(...accountRows.map((row) => row.totals.total), 1);

  return (
    <div className="view-shell">
      <ViewHeader
        eyebrow="Topsheet"
        title={scenario.name}
        description="Quadro completo del costo di produzione, aggiornato in tempo reale."
        actions={<span className="scenario-chip"><span className="status-dot" /> {scenario.scope}</span>}
      />

      <section className="metric-grid" aria-label="Riepilogo budget">
        <article className="metric-card metric-primary">
          <div className="metric-icon"><WalletCards size={18} /></div>
          <span>Costo lordo</span>
          <strong>{money.format(totals.total)}</strong>
          <small>{data.items.length} voci di dettaglio</small>
        </article>
        <article className="metric-card">
          <div className="metric-icon"><ReceiptText size={18} /></div>
          <span>Contributi</span>
          <strong>{money.format(totals.fringe)}</strong>
          <small>{totals.total ? ((totals.fringe / totals.total) * 100).toFixed(1) : '0'}% del lordo</small>
        </article>
        <article className="metric-card">
          <div className="metric-icon"><Landmark size={18} /></div>
          <span>Incentivi stimati</span>
          <strong className="positive-value">− {money.format(totals.incentive)}</strong>
          <small>{incentiveResults.filter((value) => value.amount > 0).length} programmi applicati</small>
        </article>
        <article className="metric-card">
          <div className="metric-icon"><Coins size={18} /></div>
          <span>Costo netto</span>
          <strong>{money.format(totals.net)}</strong>
          <small>Dopo tax credit e rimborsi</small>
        </article>
      </section>

      {totals.errors > 0 && (
        <div className="alert warning"><CircleAlert size={18} /><span><strong>{totals.errors} formule da controllare.</strong> Apri il dettaglio per correggere le voci.</span></div>
      )}

      <div className="dashboard-grid">
        <section className="panel account-overview">
          <div className="panel-heading">
            <div><span className="section-kicker">Macro-categorie</span><h2>Costi per account</h2></div>
            <span className="muted">{data.accounts.length} account</span>
          </div>
          <div className="account-bars">
            {accountRows.map(({ account, totals: rowTotals }) => (
              <button key={account.id} className="account-bar-row" type="button" onClick={() => onOpenAccount(account.id)}>
                <span className="account-code">{account.code}</span>
                <span className="account-bar-copy"><strong>{account.name}</strong><span className="bar-track"><span style={{ width: `${(rowTotals.total / maxTotal) * 100}%` }} /></span></span>
                <span className="account-amount">{money.format(rowTotals.total)}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>

        <aside className="panel incentive-panel">
          <div className="panel-heading"><div><span className="section-kicker">Fiscalità</span><h2>Tax credit</h2></div></div>
          {incentiveResults.map((result) => {
            const used = result.incentive.cap ? Math.min(100, result.amount / result.incentive.cap * 100) : 0;
            return (
              <div className="incentive-item" key={result.incentive.id}>
                <div className="incentive-title"><strong>{result.incentive.name}</strong><span>{result.incentive.rate}%</span></div>
                <p>{result.incentive.jurisdiction} · Base eleggibile {money.format(result.eligibleCost)}</p>
                {result.incentive.cap && <div className="cap-track"><span style={{ width: `${used}%` }} /></div>}
                <div className="incentive-total"><span>Credito stimato</span><strong>{money.format(result.amount)}</strong></div>
              </div>
            );
          })}
          {!incentiveResults.length && <p className="muted">Nessun incentivo configurato.</p>}
          <div className="net-summary"><span>Totale dopo incentivi</span><strong>{money.format(totals.net)}</strong></div>
        </aside>
      </div>

      <section className="panel topsheet-table-panel print-section">
        <div className="panel-heading"><div><span className="section-kicker">Dettaglio finanziario</span><h2>Topsheet completa</h2></div></div>
        <div className="table-wrap">
          <table className="data-table topsheet-table">
            <thead><tr><th>Account</th><th>Descrizione</th><th className="number">Costo base</th><th className="number">Contributi</th><th className="number">Totale</th><th className="number">%</th></tr></thead>
            <tbody>
              {accountRows.map(({ account, totals: rowTotals }) => (
                <tr key={account.id} onDoubleClick={() => onOpenAccount(account.id)}>
                  <td><button type="button" className="text-button" onClick={() => onOpenAccount(account.id)}>{account.code}</button></td>
                  <td><strong>{account.name}</strong></td>
                  <td className="number">{money.format(rowTotals.base)}</td>
                  <td className="number muted-cell">{money.format(rowTotals.fringe)}</td>
                  <td className="number"><strong>{money.format(rowTotals.total)}</strong></td>
                  <td className="number muted-cell">{totals.total ? ((rowTotals.total / totals.total) * 100).toFixed(1) : '0'}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={2}>Totale produzione</td><td className="number">{money.format(totals.base)}</td><td className="number">{money.format(totals.fringe)}</td><td className="number">{money.format(totals.total)}</td><td className="number">100%</td></tr>
              <tr className="credit-row"><td colSpan={4}>Incentivi fiscali stimati</td><td className="number">− {money.format(totals.incentive)}</td><td /></tr>
              <tr className="net-row"><td colSpan={4}>Costo netto</td><td className="number">{money.format(totals.net)}</td><td /></tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
