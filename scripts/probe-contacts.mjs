const PAVE = 'https://api.jobtread.com/pave';
const KEY = process.env.JOBTREAD_GRANT_KEY;
const ORG = process.env.JOBTREAD_ORG_ID;
const ACCOUNT_ID = '22NysTtFtcui';
const CONTACT_ID = '22NysTtH93vy';
const LEAD_SOURCE_FIELD_ID = '22PBe2Rsrg7J';
// Email IDs: 22NysQrgJBh4, 22NysQrgPmBM, 22NysQrgSkMe
// Phone IDs: 22NysQruwU3V, 22NysQruyLWw, 22NysQrv2D2P
const EMAIL_FIELD_ID = '22NysQrgJBh4';
const PHONE_FIELD_ID = '22NysQruwU3V';

async function safeFetch(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  return { text, parsed };
}

async function probe(label, q) {
  const { text, parsed } = await safeFetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY }, ...q } }),
  });
  if (parsed) {
    console.log(`✓ ${label}:\n`, JSON.stringify(parsed, null, 2).slice(0, 2000));
  } else {
    console.log(`✗ ${label}: ${text.slice(0, 400)}`);
  }
  console.log('---');
}

// ── 1. createContact with valid Lead Source option ─────────────────────────────
const { text: ct1text, parsed: ct1 } = await safeFetch(PAVE, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: { $: { grantKey: KEY },
    createContact: {
      $: {
        accountId: ACCOUNT_ID,
        name: '__probe__ MCP Test',
        customFieldValues: { [LEAD_SOURCE_FIELD_ID]: 'Referral' }
      },
      createdContact: { id: {}, name: {}, title: {}, createdAt: {} }
    }
  }}),
});
const newContactId = ct1?.createContact?.createdContact?.id;
console.log('createContact result:', ct1text.slice(0, 400));
console.log('---');

// ── 2. createContact with email + phone custom fields ─────────────────────────
if (newContactId) {
  console.log('Created contact:', newContactId);
  // Clean it up
  const delRes = await safeFetch(PAVE, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({query:{$:{grantKey:KEY},deleteContact:{$:{id:newContactId}}}}) });
  console.log('Deleted:', delRes.text.slice(0, 100));
}

// Now try creating with email + phone in customFieldValues
const { text: ct2text, parsed: ct2 } = await safeFetch(PAVE, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: { $: { grantKey: KEY },
    createContact: {
      $: {
        accountId: ACCOUNT_ID,
        name: '__probe__ With Email',
        customFieldValues: {
          [LEAD_SOURCE_FIELD_ID]: 'Referral',
          [EMAIL_FIELD_ID]: 'test@example.com',
          [PHONE_FIELD_ID]: '555-1234',
        }
      },
      createdContact: {
        id: {}, name: {},
        customFieldValues: {
          nodes: { id: {}, value: {}, customField: { id: {}, name: {}, type: {} } }
        }
      }
    }
  }}),
});
const contactWithEmail = ct2?.createContact?.createdContact;
console.log('createContact with email+phone:', ct2text.slice(0, 600));
if (contactWithEmail?.id) {
  await safeFetch(PAVE, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({query:{$:{grantKey:KEY},deleteContact:{$:{id:contactWithEmail.id}}}}) });
  console.log('Cleaned up contact with email');
}
console.log('---');

// ── 3. Get a contact from ANOTHER account that might have email/phone set ──────
// Get all org contacts and check for email/phone customFieldValues
await probe('sample contacts with customFieldValues (5)', {
  organization: {
    $: { id: ORG },
    contacts: {
      $: { size: 5 },
      nodes: {
        id: {}, name: {}, firstName: {}, lastName: {}, title: {},
        customFieldValues: {
          nodes: { id: {}, value: {}, customField: { id: {}, name: {}, type: {} } }
        }
      }
    }
  }
});

// ── 4. updateContact with customFieldValues ───────────────────────────────────
const { text: ut, parsed: up } = await safeFetch(PAVE, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: { $: { grantKey: KEY },
    updateContact: {
      $: {
        id: CONTACT_ID,
        customFieldValues: { [EMAIL_FIELD_ID]: 'kevin@test.com' }
      },
      contact: {
        $: { id: CONTACT_ID },
        id: {}, name: {},
        customFieldValues: { nodes: { id: {}, value: {}, customField: { id: {}, name: {} } } }
      }
    }
  }}),
});
console.log('updateContact with email customField:', ut.slice(0, 500));
console.log('---');

// ── 5. Now read the contact's email customFieldValue ─────────────────────────
await probe('contact email customFieldValue after update', {
  contact: {
    $: { id: CONTACT_ID },
    id: {}, name: {},
    customFieldValues: {
      nodes: { id: {}, value: {}, customField: { id: {}, name: {}, type: {} } }
    }
  }
});

// ── 6. Clean up — remove the email we just set ────────────────────────────────
const { text: clean } = await safeFetch(PAVE, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: { $: { grantKey: KEY },
    updateContact: {
      $: { id: CONTACT_ID, customFieldValues: { [EMAIL_FIELD_ID]: null } },
      contact: { $: { id: CONTACT_ID }, id: {}, name: {} }
    }
  }}),
});
console.log('Cleaned up email:', clean.slice(0, 150));
