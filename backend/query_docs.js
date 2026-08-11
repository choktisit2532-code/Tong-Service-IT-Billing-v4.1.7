const { Client } = require('pg');

async function main() {
  const connectionString = 'postgresql://neondb_owner:npg_rPAVL5KEI8vq@ep-lucky-sunset-afakcp8v-pooler.c-2.us-west-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require';
  const client = new Client({ connectionString });
  await client.connect();

  console.log('--- LATEST AUDIT LOGS ---');
  const auditRes = await client.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 15');
  console.table(auditRes.rows.map(r => ({
    id: r.id,
    action: r.action,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    user_id: r.user_id,
    details: JSON.stringify(r.details),
    created_at: r.created_at
  })));

  console.log('\n--- DOCUMENT_RELATIONS ---');
  const rels = await client.query(`
    SELECT dr.id, dr.source_document_id, s.document_number AS source_number, s.document_type AS source_type, s.status AS source_status,
           dr.target_document_id, t.document_number AS target_number, t.document_type AS target_type, t.status AS target_status,
           dr.relation_type
    FROM document_relations dr
    JOIN documents s ON s.id = dr.source_document_id
    JOIN documents t ON t.id = dr.target_document_id
    ORDER BY dr.id
  `);
  console.table(rels.rows);

  await client.end();
}

main().catch(console.error);
