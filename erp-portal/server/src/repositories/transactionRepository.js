export async function listUnifiedTransactions(connection, tenantId, options = {}) {
  const { type = 'all', startDate = null, endDate = null, projectId = null, role = null } = options;

  const queries = [];
  const params = [];

  const includePayroll = (type === 'all' || type === 'payroll') && role !== 'Manager';
  const includeAdvance = (type === 'all' || type === 'advance') && role !== 'Manager';
  const includeClientPayment = type === 'all' || type === 'client_payment';

  // 1. Payroll Payments (Money Out)
  if (includePayroll && !projectId) {
    let payrollSql = `
      SELECT
        pli.id AS id,
        'payroll' AS type,
        'salary_payout' AS sub_type,
        pli.employee_name AS party_name,
        pli.employee_id AS party_id,
        pli.net_amount AS amount,
        'out' AS flow,
        TO_CHAR(COALESCE(pli.paid_at, pr.finalized_at, pr.created_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS transaction_date,
        pli.payment_status AS status,
        pr.id AS run_id,
        pli.id AS line_item_id,
        TO_CHAR(COALESCE(pli.period_start_date, pr.period_start_date), 'YYYY-MM-DD') AS period_start_date,
        TO_CHAR(COALESCE(pli.period_end_date, pr.period_end_date), 'YYYY-MM-DD') AS period_end_date,
        NULL AS invoice_number,
        NULL AS project_id,
        NULL AS project_name,
        ('Payroll Payout (' || TO_CHAR(COALESCE(pli.period_start_date, pr.period_start_date), 'DD Mon') || ' - ' || TO_CHAR(COALESCE(pli.period_end_date, pr.period_end_date), 'DD Mon YYYY') || ')') AS description
      FROM payroll_line_items pli
      JOIN payroll_runs pr ON pr.id = pli.run_id
      WHERE pli.tenant_id = ? AND pli.payment_status = 'paid'
    `;
    params.push(tenantId);

    if (startDate) {
      payrollSql += ` AND (pli.paid_at >= ?::timestamp OR (pli.paid_at IS NULL AND pr.created_at >= ?::timestamp))`;
      params.push(startDate, startDate);
    }
    if (endDate) {
      payrollSql += ` AND (pli.paid_at <= (?::date + INTERVAL '1 day')::timestamp OR (pli.paid_at IS NULL AND pr.created_at <= (?::date + INTERVAL '1 day')::timestamp))`;
      params.push(endDate, endDate);
    }

    queries.push(payrollSql);
  }

  // 2. Employee Advances (Money Out)
  if (includeAdvance && !projectId) {
    let advanceSql = `
      SELECT
        ea.id AS id,
        'advance' AS type,
        'employee_advance' AS sub_type,
        e.name AS party_name,
        ea.employee_id AS party_id,
        ea.amount AS amount,
        'out' AS flow,
        TO_CHAR(ea.advance_date::timestamp, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS transaction_date,
        ea.status AS status,
        ea.adjusted_in_run_id AS run_id,
        NULL AS line_item_id,
        NULL AS period_start_date,
        NULL AS period_end_date,
        NULL AS invoice_number,
        NULL AS project_id,
        NULL AS project_name,
        COALESCE(ea.notes, 'Employee Salary Advance') AS description
      FROM employee_advances ea
      JOIN employees e ON e.id = ea.employee_id
      WHERE ea.tenant_id = ? AND ea.status != 'cancelled'
    `;
    params.push(tenantId);

    if (startDate) {
      advanceSql += ` AND ea.advance_date >= ?::date`;
      params.push(startDate);
    }
    if (endDate) {
      advanceSql += ` AND ea.advance_date <= ?::date`;
      params.push(endDate);
    }

    queries.push(advanceSql);
  }

  // 3. Client Payments Received (Money In)
  if (includeClientPayment) {
    let clientSql = `
      SELECT
        i.id AS id,
        'client_payment' AS type,
        'invoice_payment' AS sub_type,
        i.client_name AS party_name,
        i.id AS party_id,
        i.paid_amount AS amount,
        'in' AS flow,
        TO_CHAR(COALESCE(i.updated_at, i.invoice_date::timestamp), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS transaction_date,
        i.status AS status,
        NULL AS run_id,
        NULL AS line_item_id,
        NULL AS period_start_date,
        NULL AS period_end_date,
        i.invoice_number AS invoice_number,
        i.project_id AS project_id,
        p.name AS project_name,
        ('Payment for Invoice #' || i.invoice_number || (CASE WHEN p.name IS NOT NULL THEN ' (' || p.name || ')' ELSE '' END)) AS description
      FROM invoices i
      LEFT JOIN projects p ON p.id = i.project_id
      WHERE i.tenant_id = ? AND i.removed_at IS NULL AND (i.paid_amount > 0 OR i.status IN ('paid', 'partial'))
    `;
    params.push(tenantId);

    if (projectId) {
      clientSql += ` AND i.project_id = ?`;
      params.push(projectId);
    }
    if (startDate) {
      clientSql += ` AND (i.invoice_date >= ?::date OR i.updated_at >= ?::timestamp)`;
      params.push(startDate, startDate);
    }
    if (endDate) {
      clientSql += ` AND (i.invoice_date <= ?::date OR i.updated_at <= (?::date + INTERVAL '1 day')::timestamp)`;
      params.push(endDate, endDate);
    }

    queries.push(clientSql);
  }

  if (queries.length === 0) {
    return {
      items: [],
      summary: { totalIn: 0, totalOut: 0, netBalance: 0, totalCount: 0 }
    };
  }

  const combinedSql = queries.join(' UNION ALL ') + ` ORDER BY transaction_date DESC`;
  const [rows] = await connection.execute(combinedSql, params);

  let totalIn = 0;
  let totalOut = 0;

  const items = rows.map((r) => {
    const amt = Number(r.amount || 0);
    if (r.flow === 'in') totalIn += amt;
    else totalOut += amt;

    return {
      id: r.id,
      type: r.type,
      subType: r.sub_type,
      partyName: r.party_name,
      partyId: r.party_id,
      amount: amt,
      flow: r.flow,
      transactionDate: r.transaction_date,
      status: r.status,
      runId: r.run_id,
      lineItemId: r.line_item_id,
      periodStartDate: r.period_start_date,
      periodEndDate: r.period_end_date,
      invoiceNumber: r.invoice_number,
      projectId: r.project_id,
      projectName: r.project_name,
      description: r.description
    };
  });

  return {
    items,
    summary: {
      totalIn: Math.round(totalIn * 100) / 100,
      totalOut: Math.round(totalOut * 100) / 100,
      netBalance: Math.round((totalIn - totalOut) * 100) / 100,
      totalCount: items.length
    }
  };
}
