import { pool } from '../db/pool.js';
import { listUnifiedTransactions } from '../repositories/transactionRepository.js';
import { generateTransactionHistoryPdf } from '../utils/pdfGenerator.js';
import { generateTransactionHistoryExcel } from '../utils/excelGenerator.js';

export async function getTransactions(context, query = {}) {
  const connection = await pool.getConnection();
  try {
    const result = await listUnifiedTransactions(connection, context.tenantId, {
      type: query.type || 'all',
      startDate: query.startDate || null,
      endDate: query.endDate || null,
      projectId: query.projectId || null,
      role: context.role
    });
    return result;
  } finally {
    connection.release();
  }
}

export async function exportTransactionsReport(context, query = {}, format = 'pdf') {
  const connection = await pool.getConnection();
  try {
    const result = await listUnifiedTransactions(connection, context.tenantId, {
      type: query.type || 'all',
      startDate: query.startDate || null,
      endDate: query.endDate || null,
      projectId: query.projectId || null,
      role: context.role
    });

    const [tenantRows] = await connection.execute(
      `SELECT id, business_name, gst_number FROM tenants WHERE id = ? LIMIT 1`,
      [context.tenantId]
    );
    const tenant = tenantRows[0] || { businessName: 'TheWoodWise' };

    if (format === 'excel' || format === 'xlsx') {
      const buffer = await generateTransactionHistoryExcel(result, tenant, query);
      return {
        buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `Transaction_History_${new Date().toISOString().slice(0, 10)}.xlsx`
      };
    }

    const buffer = await generateTransactionHistoryPdf(result, tenant, query);
    return {
      buffer,
      contentType: 'application/pdf',
      filename: `Transaction_History_${new Date().toISOString().slice(0, 10)}.pdf`
    };
  } finally {
    connection.release();
  }
}
