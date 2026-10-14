
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { getCurrentMonth } from "../utils/dates.js";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";


const money = (amount) =>
  amount == null
    ? "—"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(amount);

export default function Forecasts() {
  const [month, setMonth] = useState(getCurrentMonth);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");
    setSummary(null);

    api(`/api/dashboard/summary?month=${encodeURIComponent(month)}`)
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((err) => {
        if (active) setError(err.message || "Unable to load forecasts.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [month]);

  const comparison = summary?.comparison;
  const forecast = summary?.forecast;
  const insights = summary?.insights;

const trendData = buildTrendData(summary);

const comparisonData = summary
  ? [
      {
        name: "Previous month",
        amount: Number(comparison?.previous_spent || 0),
      },
      {
        name: "Selected month",
        amount: Number(summary.total_spent || 0),
      },
    ]
  : [];


function buildTrendData(summary) {
  if (!summary?.forecast || summary.forecast.elapsed_days === 0) {
    return [];
  }

  const { total_days: totalDays, elapsed_days: elapsedDays } =
    summary.forecast;

  const dailyTotals = new Map(
    summary.daily.map((item) => [
      String(item.date).slice(0, 10).slice(8, 10),
      Number(item.total),
    ])
  );

  let cumulative = 0;
  const averagePerDay =
    Number(summary.total_spent) / elapsedDays;

  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const actualDaily = dailyTotals.get(String(day).padStart(2, "0")) || 0;

    if (day <= elapsedDays) {
      cumulative += actualDaily;
    }

    const actualCumulative = day <= elapsedDays ? cumulative : null;

    const projectedCumulative =
      day < elapsedDays
        ? null
        : Math.round(
            (Number(summary.total_spent) +
              averagePerDay * Math.max(0, day - elapsedDays)) *
              100
          ) / 100;

    return {
      day: String(day),
      actual: actualCumulative,
      projected: projectedCumulative,
    };
  });
}


  const comparisonMessage = () => {
    if (!comparison) return "Comparison unavailable.";

    if (comparison.previous_spent === 0 && summary.total_spent > 0) {
      return "You have spending this month, but no spending in the previous month.";
    }

    if (comparison.previous_spent === 0 && summary.total_spent === 0) {
      return "No spending recorded in either month.";
    }

    if (comparison.difference === 0) {
      return "Your spending is unchanged from last month.";
    }

    const direction =
      comparison.difference > 0 ? "more" : "less";

    const percentage =
      comparison.percent_change == null
        ? ""
        : ` (${Math.abs(comparison.percent_change).toFixed(1)}%)`;

    return `You spent ${money(Math.abs(comparison.difference))}${percentage} ${direction} than last month.`;
  };

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">PLAN AHEAD</p>
          <h1>Forecasts</h1>
          <p className="muted">
            Understand your spending trends and estimate where your money is going.
          </p>
        </div>

        <label className="month-picker">
          Month
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
      </header>

      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="loading">Loading your forecasts…</p>}

      {!loading && summary && (
        <>
          <section className="summary-grid" aria-label="Forecast summary">
            <SummaryCard
              title="Estimated month-end spending"
              value={money(forecast?.estimated_month_end)}
              detail={
                forecast?.estimated_month_end == null
                  ? "Not enough elapsed time to estimate"
                  : "Based on average daily spending"
              }
            />

            <SummaryCard
              title="Spent so far"
              value={money(summary.total_spent)}
              detail={`${forecast?.elapsed_days ?? 0} of ${forecast?.total_days ?? 0} days elapsed`}
            />

            <SummaryCard
              title="Previous month"
              value={money(comparison?.previous_spent)}
              detail={comparison?.previous_month || ""}
            />

            <SummaryCard
              title="Change in spending"
              value={
                comparison?.percent_change == null
                  ? "—"
                  : `${comparison.percent_change > 0 ? "+" : ""}${comparison.percent_change.toFixed(1)}%`
              }
              detail={
                comparison
                  ? `${comparison.difference > 0 ? "+" : ""}${money(comparison.difference)} vs last month`
                  : "Comparison unavailable"
              }
            />
          </section>


          <section className="forecast-charts">
            <div className="panel chart-panel forecast-trend-panel">
              <div className="panel-heading">
                <div>
                  <h2>Spending trajectory</h2>
                  <p className="muted">
                    Recorded cumulative spending versus the projected trend
                  </p>
                </div>
              </div>

              {trendData.length === 0 ? (
                <p className="muted">
                  A spending trajectory will appear once the selected month
                  has started.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart
                    data={trendData}
                    margin={{ top: 12, right: 12, bottom: 4, left: 8 }}
                  >
                    <defs>
                      <linearGradient
                        id="actualSpendingFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#5c61d6"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#5c61d6"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--border, #e6e7ee)"
                    />

                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(day) => Number(day) % 5 === 0 || day === "1" ? day : ""}
                    />

                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={72}
                      tickFormatter={(value) => `₹${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
                    />

                    <Tooltip
                      labelFormatter={(day) => `Day ${day}`}
                      formatter={(value, name) => [
                        money(value),
                        name === "actual"
                          ? "Recorded spending"
                          : "Projected spending",
                      ]}
                    />

                    <Legend
                      formatter={(value) =>
                        value === "actual"
                          ? "Recorded spending"
                          : "Projected trend"
                      }
                    />

                    {forecast?.elapsed_days > 0 && (
                      <ReferenceLine
                        x={String(forecast.elapsed_days)}
                        stroke="#8290a6"
                        strokeDasharray="4 4"
                        label={{
                          value: "Today",
                          position: "insideTopRight",
                          fill: "#8290a6",
                          fontSize: 11,
                        }}
                      />
                    )}

                    <Area
                      type="monotone"
                      dataKey="actual"
                      stroke="#5c61d6"
                      strokeWidth={2.5}
                      fill="url(#actualSpendingFill)"
                      connectNulls={false}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />

                    <Line
                      type="monotone"
                      dataKey="projected"
                      stroke="#41a58d"
                      strokeWidth={2.5}
                      strokeDasharray="6 5"
                      connectNulls={false}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
              <p className="muted forecast-chart-note">
                The projection extends your average spending so far across
                the remaining days. It is an estimate, not a guarantee.
              </p>
            </div>

            <div className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <h2>Monthly comparison</h2>
                  <p className="muted">
                    How recorded spending compares between months
                  </p>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={comparisonData}
                  layout="vertical"
                  margin={{ top: 12, right: 18, bottom: 8, left: 12 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="var(--border, #e6e7ee)"
                  />

                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      `₹${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`
                    }
                  />

                  <YAxis
                    type="category"
                    dataKey="name"
                    width={112}
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />

                  <Tooltip
                    formatter={(value) => [money(value), "Total spent"]}
                  />

                  <Bar dataKey="amount" radius={[0, 7, 7, 0]}>
                    {comparisonData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={index === 0 ? "#aab0c0" : "#5c61d6"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <p className="comparison-message">
                {comparisonMessage()}
              </p>
            </div>

            <div className="panel chart-panel forecast-budget-panel">
              <div className="panel-heading">
                <div>
                  <h2>Projected budget usage</h2>
                  <p className="muted">
                    Your estimated spending relative to your monthly budget
                  </p>
                </div>
              </div>

              {summary.budget == null ? (
                <p className="muted">
                  Set a monthly budget to see how your forecast compares with
                  your spending limit.
                </p>
              ) : forecast?.estimated_month_end == null ? (
                <p className="muted">
                  A projection will be available once the selected month starts.
                </p>
              ) : (
                <>
                  <div className="budget-forecast-values">
                    <div>
                      <span className="muted">Projected spending</span>
                      <strong>
                        {money(forecast.estimated_month_end)}
                      </strong>
                    </div>
                    <div>
                      <span className="muted">Monthly budget</span>
                      <strong>{money(summary.budget)}</strong>
                    </div>
                  </div>

                  <div
                    className={`forecast-budget-track ${
                      forecast.estimated_month_end > summary.budget
                        ? "over"
                        : ""
                    }`}
                    role="progressbar"
                    aria-label="Projected budget usage"
                    aria-valuemin={0}
                    aria-valuenow={Math.min(
                      100,
                      Math.round(
                        (forecast.estimated_month_end / summary.budget) * 100
                      )
                    )}
                    aria-valuemax={100}
                  >
                    <span
                      style={{
                        width: `${Math.min(
                          100,
                          (forecast.estimated_month_end / summary.budget) * 100
                        )}%`,
                      }}
                    />
                  </div>

                  <p
                    className={
                      forecast.estimated_month_end > summary.budget
                        ? "forecast-status over"
                        : "forecast-status"
                    }
                  >
                    {forecast.estimated_month_end > summary.budget
                      ? `Projected to exceed your budget by ${money(
                          forecast.estimated_month_end - summary.budget
                        )}.`
                      : `Projected to stay within budget by ${money(
                          summary.budget - forecast.estimated_month_end
                        )}.`}
                  </p>
                </>
              )}
            </div>
          </section>


          <section className="chart-grid">
            <div className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <h2>Month-end projection</h2>
                  <p className="muted">
                    An estimate based on spending recorded so far.
                  </p>
                </div>
              </div>

              <div className="forecast-highlight">
                <strong>{money(forecast?.estimated_month_end)}</strong>
                <p className="muted">
                  {forecast?.elapsed_days === 0
                    ? "The selected month has not started yet, so a forecast is not available."
                    : forecast?.elapsed_days === forecast?.total_days
                      ? "The selected month is complete. This reflects the recorded total."
                      : `Based on ${forecast?.elapsed_days} elapsed days out of ${forecast?.total_days}. Actual spending may differ.`}
                </p>
              </div>

              {summary.budget != null && forecast?.estimated_month_end != null && (
                <p className="forecast-budget-note">
                  {forecast.estimated_month_end > summary.budget
                    ? `Your projection is ${money(forecast.estimated_month_end - summary.budget)} above your monthly budget.`
                    : `Your projection is ${money(summary.budget - forecast.estimated_month_end)} below your monthly budget.`}
                </p>
              )}
            </div>

            <div className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <h2>Month-over-month comparison</h2>
                  <p className="muted">
                    Compare spending with {comparison?.previous_month}.
                  </p>
                </div>
              </div>

              <div className="comparison-values">
                <div>
                  <p className="muted">Previous month</p>
                  <strong>{money(comparison?.previous_spent)}</strong>
                </div>
                <div>
                  <p className="muted">Selected month</p>
                  <strong>{money(summary.total_spent)}</strong>
                </div>
              </div>

              <p className="comparison-message">{comparisonMessage()}</p>
            </div>
          </section>

          <section className="chart-grid">
            <div className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <h2>Top spending category</h2>
                  <p className="muted">Your biggest category this month.</p>
                </div>
              </div>

              {insights?.top_category ? (
                <div className="forecast-highlight">
                  <strong>{insights.top_category.category_name}</strong>
                  <p>{money(insights.top_category.total)}</p>
                  <p className="muted">
                    {summary.total_spent > 0
                      ? `${((insights.top_category.total / summary.total_spent) * 100).toFixed(1)}% of your recorded spending`
                      : ""}
                  </p>
                </div>
              ) : (
                <p className="muted">No expenses recorded for this month yet.</p>
              )}
            </div>

            <div className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <h2>Largest expense</h2>
                  <p className="muted">Highest-value transaction this month.</p>
                </div>
              </div>

              {insights?.largest_expense ? (
                <div className="forecast-highlight">
                  <strong>{money(insights.largest_expense.amount)}</strong>
                  <p>
                    {insights.largest_expense.description || "Untitled expense"}
                  </p>
                  <p className="muted">
                    {insights.largest_expense.category_name} ·{" "}
                    {String(insights.largest_expense.expense_date).slice(0, 10)}
                  </p>
                </div>
              ) : (
                <p className="muted">No expenses recorded for this month yet.</p>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}

function SummaryCard({ title, value, detail }) {
  return (
    <div className="summary-card">
      <p>{title}</p>
      <strong>{value}</strong>
      {detail && <p className="muted">{detail}</p>}
    </div>
  );
}
