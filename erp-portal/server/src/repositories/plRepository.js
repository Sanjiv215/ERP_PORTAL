import { randomUUID } from 'node:crypto';

export async function insertProjectExpense(connection, tenantId, expense, recordedBy) {
  const id = randomUUID();
  await connection.execute(
    `INSERT INTO expense_entries
       (id, tenant_id, project_id, entry_date, category, description, amount, receipt_url, recorded_by, auto_posted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      tenantId,
      expense.projectId || null,
      expense.entryDate,
      expense.category,
      expense.description || null,
      expense.amount,
      expense.receiptUrl || null,
      recordedBy,
      Boolean(expense.autoPosted)
    ]
  );
  return id;
}

export async function insertProjectIncome(connection, tenantId, income, recordedBy) {
  const id = randomUUID();
  await connection.execute(
    `INSERT INTO income_entries
       (id, tenant_id, project_id, entry_date, category, description, amount, reference_id, recorded_by, auto_posted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      tenantId,
      income.projectId || null,
      income.entryDate,
      income.category || 'revenue',
      income.description || null,
      income.amount,
      income.referenceId || null,
      recordedBy,
      Boolean(income.autoPosted)
    ]
  );
  return id;
}

export async function getBusinessPLSummary(connection, tenantId, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;

  const [incomeRows] = await connection.execute(
    `SELECT category, SUM(amount) AS total
     FROM income_entries
     WHERE tenant_id = ? AND EXTRACT(YEAR FROM entry_date) = ? AND EXTRACT(MONTH FROM entry_date) = ?
     GROUP BY category
     ORDER BY category`,
    [tenantId, Number(year), Number(month)]
  );

  const [expenseRows] = await connection.execute(
    `SELECT category, SUM(amount) AS total
     FROM expense_entries
     WHERE tenant_id = ? AND EXTRACT(YEAR FROM entry_date) = ? AND EXTRACT(MONTH FROM entry_date) = ?
     GROUP BY category
     ORDER BY category`,
    [tenantId, Number(year), Number(month)]
  );

  const totalIncome = incomeRows.reduce((sum, r) => sum + Number(r.total || 0), 0);
  const totalExpense = expenseRows.reduce((sum, r) => sum + Number(r.total || 0), 0);
  const netProfit = Math.round((totalIncome - totalExpense) * 100) / 100;
  const marginPercentage = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 10000) / 100 : 0;

  return {
    period: prefix,
    incomeCategories: incomeRows.map((r) => ({ category: r.category, amount: Number(r.total) })),
    expenseCategories: expenseRows.map((r) => ({ category: r.category, amount: Number(r.total) })),
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    netProfit,
    marginPercentage
  };
}

export async function getProjectPLSummary(connection, tenantId, projectId) {
  const [projectRows] = await connection.execute(
    `SELECT id, name, client_name, status, start_date FROM projects WHERE tenant_id = ? AND id = ? LIMIT 1`,
    [tenantId, projectId]
  );
  const [incomeRows] = await connection.execute(
    `SELECT category, SUM(amount) AS total
     FROM income_entries
     WHERE tenant_id = ? AND project_id = ?
     GROUP BY category`,
    [tenantId, projectId]
  );
  const [expenseRows] = await connection.execute(
    `SELECT category, SUM(amount) AS total
     FROM expense_entries
     WHERE tenant_id = ? AND project_id = ?
     GROUP BY category`,
    [tenantId, projectId]
  );

  if (!projectRows[0]) return null;

  const totalIncome = incomeRows.reduce((sum, r) => sum + Number(r.total || 0), 0);
  const totalExpense = expenseRows.reduce((sum, r) => sum + Number(r.total || 0), 0);
  const netProfit = Math.round((totalIncome - totalExpense) * 100) / 100;
  const marginPercentage = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 10000) / 100 : 0;

  return {
    project: projectRows[0],
    incomeCategories: incomeRows.map((r) => ({ category: r.category, amount: Number(r.total) })),
    expenseCategories: expenseRows.map((r) => ({ category: r.category, amount: Number(r.total) })),
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    netProfit,
    marginPercentage
  };
}

export async function listAllProjectsPL(connection, tenantId) {
  const [projects] = await connection.execute(
    `SELECT p.id, p.name, p.client_name, p.status, p.created_at,
            COALESCE((SELECT SUM(amount) FROM income_entries WHERE tenant_id = p.tenant_id AND project_id = p.id), 0) AS total_income,
            COALESCE((SELECT SUM(amount) FROM expense_entries WHERE tenant_id = p.tenant_id AND project_id = p.id), 0) AS total_expense
     FROM projects p
     WHERE p.tenant_id = ?
     ORDER BY p.created_at DESC`,
    [tenantId]
  );

  return projects.map((p) => {
    const inc = Number(p.total_income || 0);
    const exp = Number(p.total_expense || 0);
    const net = Math.round((inc - exp) * 100) / 100;
    const margin = inc > 0 ? Math.round(((inc - exp) / inc) * 10000) / 100 : 0;
    return {
      id: p.id,
      name: p.name,
      clientName: p.client_name,
      status: p.status,
      income: Math.round(inc * 100) / 100,
      expense: Math.round(exp * 100) / 100,
      totalIncome: Math.round(inc * 100) / 100,
      totalExpense: Math.round(exp * 100) / 100,
      netProfit: net,
      marginPercentage: margin
    };
  });
}

export async function getAnnualTrend(connection, tenantId, year) {
  const [monthlyStats] = await connection.execute(
    `SELECT
       months.month_num,
       COALESCE(inc.total_income, 0) AS income,
       COALESCE(exp.total_expense, 0) AS expense
     FROM (
       SELECT 1 AS month_num UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
       UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8
       UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
     ) months
     LEFT JOIN (
       SELECT EXTRACT(MONTH FROM entry_date)::int AS m, SUM(amount) AS total_income
       FROM income_entries
       WHERE tenant_id = ? AND EXTRACT(YEAR FROM entry_date) = ?
       GROUP BY EXTRACT(MONTH FROM entry_date)
     ) inc ON inc.m = months.month_num
     LEFT JOIN (
       SELECT EXTRACT(MONTH FROM entry_date)::int AS m, SUM(amount) AS total_expense
       FROM expense_entries
       WHERE tenant_id = ? AND EXTRACT(YEAR FROM entry_date) = ?
       GROUP BY EXTRACT(MONTH FROM entry_date)
     ) exp ON exp.m = months.month_num
     ORDER BY months.month_num ASC`,
    [tenantId, year, tenantId, year]
  );

  return monthlyStats.map((r) => ({
    month: r.month_num,
    income: Number(r.income),
    expense: Number(r.expense),
    net: Math.round((Number(r.income) - Number(r.expense)) * 100) / 100
  }));
}
