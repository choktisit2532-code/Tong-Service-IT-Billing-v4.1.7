const { Client } = require('pg');

async function main() {
  const connectionString = 'postgresql://neondb_owner:npg_rPAVL5KEI8vq@ep-lucky-sunset-afakcp8v-pooler.c-2.us-west-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require';
  const client = new Client({ connectionString });
  await client.connect();

  console.log('--- TABLES ---');
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log(tables.rows.map(r => r.table_name));

  console.log('\n--- TRIGGERS ---');
  const triggers = await client.query(`
    SELECT trigger_name, event_manipulation, event_object_table, action_statement
    FROM information_schema.triggers
  `);
  console.table(triggers.rows);

  console.log('\n--- CONSTRAINTS ---');
  const constraints = await client.query(`
    SELECT table_name, constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
  `);
  console.table(constraints.rows);

  await client.end();
}

main().catch(console.error);
