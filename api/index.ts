import express from "express";
import path from "path";
import cors from "cors";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import axios from "axios";

// Dynamically read firebase config safely across different node and package environments
let firebaseConfig: any = {};
try {
  const possiblePaths = [
    path.join(process.cwd(), "firebase-applet-config.json"),
    path.join(process.cwd(), "../firebase-applet-config.json"),
    path.resolve(__dirname, "firebase-applet-config.json"),
    path.resolve(__dirname, "../firebase-applet-config.json"),
    path.resolve(__dirname, "../../firebase-applet-config.json")
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      firebaseConfig = JSON.parse(fs.readFileSync(p, "utf8"));
      break;
    }
  }
} catch (e) {
  console.error("[AdminHub] Failed to load firebase config dynamically:", e);
}

// Initialize Firebase Admin
let firebaseAdminApp: any;
try {
  if (getApps().length === 0) {
    firebaseAdminApp = initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log(`[AdminHub] Firebase Admin initialized for project: ${firebaseConfig.projectId}`);
  } else {
    firebaseAdminApp = getApps()[0];
  }
} catch (error) {
  console.error("[AdminHub] Critical failure initializing Firebase Admin:", error);
}

// Explicitly pass the app reference and database ID
const db = getFirestore(firebaseAdminApp, firebaseConfig.firestoreDatabaseId);

const app = express();

app.use(express.json());

// CORS configuration for integrations
// Allows the AdminHub to be reached by external systems like the store or Nexus
app.use("/api/integration", cors());

// Logging middleware for debugging integrations
app.use("/api/integration", (req, res, next) => {
  console.log(`[AdminHub Inbound] ${req.method} ${req.url}`);
  next();
});

// Health check for integrations
app.get("/api/integration/ping", (req, res) => {
  console.log("[AdminHub] Ping received!");
  res.json({ status: "alive", timestamp: new Date().toISOString() });
});

// --- AUTH MIDDLEWARE FOR INTEGRATIONS ---
const apiKeyMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  let providedKey = req.header("X-API-Key") || req.header("x-api-key");
  
  // Check Authorization Bearer header
  const authHeader = req.header("Authorization") || req.header("authorization");
  if (!providedKey && authHeader) {
    if (authHeader.startsWith("Bearer ") || authHeader.startsWith("bearer ")) {
      providedKey = authHeader.substring(7).trim();
    } else {
      providedKey = authHeader.trim();
    }
  }

  // Check query parameter
  if (!providedKey && req.query.api_key) {
    providedKey = req.query.api_key as string;
  }

  // 1. Try Env Var
  let requiredKey = process.env.ADMINHUB_API_KEY;

  // 2. Fallback to DB
  if (!requiredKey) {
    try {
      const configSnap = await db.collection('system').doc('config').get();
      if (configSnap.exists) {
        requiredKey = configSnap.data()?.integrations?.adminHubApiKey;
      }
    } catch (dbError) {
      console.error("[AdminHub Auth] Error fetching config from Firestore:", dbError);
    }
  }

  if (!requiredKey) {
    console.error("[AdminHub Auth] ADMINHUB_API_KEY is not defined in environment or database.");
    return res.status(500).json({ error: "Server authentication misconfigured." });
  }

  if (!providedKey || providedKey !== requiredKey) {
    console.warn(`[AdminHub Auth] Unauthorized access attempt. Key prefix supplied: ${providedKey ? providedKey.substring(0, 8) + '...' : 'NONE'}`);
    
    // Permanent Audit Log for unauthorized access attempts
    try {
      await db.collection('auditLogs').add({
        action: 'failed_login',
        resource: 'auth',
        resourceId: 'api-auth-failure',
        userId: 'system-integration-unauthorized',
        userName: 'Unauthorized API Access Attempt',
        timestamp: FieldValue.serverTimestamp(),
        changes: {
          before: { status: "unauthorized" },
          after: { 
            error: "Acesso não autorizado. Por favor forneça uma chave de API válida...", 
            method: req.method,
            path: req.originalUrl || req.url,
            query: req.query,
            headers: {
              "x-api-key-supplied": !!(req.header("X-API-Key") || req.header("x-api-key")),
              "bearer-supplied": !!authHeader
            }
          }
        }
      });
    } catch (logError) {
      console.error("[AdminHub Auth] Error logging auth failure to Firestore:", logError);
    }

    return res.status(401).json({ error: "Acesso não autorizado. Por favor forneça uma chave de API válida..." });
  }
  next();
};

// --- INTEGRATION ENDPOINTS ---

/**
 * 1. Recepção do Fluxo Financeiro (Origem: Loja Dicas by Ale)
 * Recebe dados de vendas concluídas para controle financeiro.
 */
app.post("/api/integration/finance", apiKeyMiddleware, async (req, res) => {
  try {
    const value = req.body.value !== undefined ? req.body.value : req.body.valor;
    const origin = req.body.origin || req.body.origem;
    const sector = req.body.sector || req.body.setor || "Varejo";
    const date = req.body.date || req.body.data;
    const transactionStatus = req.body.transactionStatus || req.body.statusDaTransacao || req.body.statusDaTransação || "pending_approval";
    const auditStatus = req.body.auditStatus || req.body.statusDaAuditoria || "pending";

    if (!value || !origin) {
      const errorMsg = "Campos obrigatórios ausentes. Forneça pelo menos os parâmetros value/valor e origin/origem.";
      const missingFields = [];
      if (!value) missingFields.push("value/valor");
      if (!origin) missingFields.push("origin/origem");

      // Log transaction rejection to auditLogs
      try {
        await db.collection('auditLogs').add({
          action: 'create',
          resource: 'transactions',
          resourceId: 'finance-integration-failure',
          userId: 'system-integration',
          userName: 'Loja Dicas Connector',
          timestamp: FieldValue.serverTimestamp(),
          changes: {
            before: { status: "rejected_format" },
            after: { 
              error: errorMsg,
              missing_parameters: missingFields,
              payload_received: req.body 
            }
          }
        });
      } catch (logError) {
        console.error("[Finance Integration] Error writing failure log:", logError);
      }

      return res.status(400).json({ error: errorMsg });
    }

    const transactionData = {
      title: `Venda: ${origin}`,
      amount: parseFloat(value),
      type: 'income',
      category: 'Sales',
      costCenter: sector,
      date: date ? Timestamp.fromDate(new Date(date)) : FieldValue.serverTimestamp(),
      status: transactionStatus,
      auditStatus: auditStatus,
      origin: origin,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      notes: "Automated entry from Loja Dicas by Ale integration."
    };

    const docRef = await db.collection('transactions').add(transactionData);

    // Audit Log for Success
    await db.collection('auditLogs').add({
      action: 'create',
      resource: 'transactions',
      resourceId: docRef.id,
      userId: 'system-integration',
      userName: 'Loja Dicas Connector',
      timestamp: FieldValue.serverTimestamp(),
      changes: { after: transactionData }
    });

    res.status(201).json({ status: "success", transactionId: docRef.id });
  } catch (error) {
    console.error("[Finance Integration] Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * 2. Recepção de Dados de RH (Origem: Nexus)
 * Recebe cadastros de funcionários vindos do ERP Nexus ou do AdminHub.
 */
app.post("/api/integration/hr/nexus", apiKeyMiddleware, async (req, res) => {
  try {
    const employeeIdInput = req.body.id || req.body.employeeId;
    const name = req.body.name || req.body.nome;
    const email = req.body.email;
    const phone = req.body.phone || req.body.telefone || '';
    const documentId = req.body.documentId || req.body.documentoId || req.body.documento || req.body.cpf_cnpj || '';
    const role = req.body.role || req.body.papel || req.body.position || req.body.cargo || req.body.funcao || req.body.função;

    // Business validation: name, email, and role/position are required
    if (!name || !email || !role) {
      const errorMsg = "Campos obrigatórios ausentes. Forneça pelo menos name, email, e role/position.";
      const missingFields = [];
      if (!name) missingFields.push("name/nome");
      if (!email) missingFields.push("email");
      if (!role) missingFields.push("role/papel/position");

      try {
        await db.collection('auditLogs').add({
          action: 'create',
          resource: 'employees',
          resourceId: 'hr-integration-failure',
          userId: 'system-integration',
          userName: 'Nexus ERP Connector',
          timestamp: FieldValue.serverTimestamp(),
          changes: {
            before: { status: "rejected_format" },
            after: { 
              error: errorMsg,
              description: `Ocorreu uma falha na integração devido a dados incompletos ou mal formatados. Parâmetro(s) incorreto(s) ou ausente(s): ${missingFields.join(', ')}`,
              payload_received: req.body 
            }
          }
        });
      } catch (logError) {
        console.error("[HR Integration] Error writing failure log:", logError);
      }

      return res.status(400).json({ error: errorMsg });
    }

    // Check if employee already exists by email
    const existing = await db.collection('employees').where('email', '==', email).get();
    if (!existing.empty) {
      return res.status(200).json({ status: "exists", id: existing.docs[0].id });
    }

    // Intelligent Department Mapping
    const getIntelligentDepartment = (roleStr: string): { id: string; name: string } => {
      const r = (roleStr || '').toLowerCase();
      if (r.includes('consultor') || r.includes('venda') || r.includes('sales') || r.includes('comercia') || r.includes('marketing')) {
        return { id: 'comercial', name: 'Comercial' };
      }
      if (r.includes('dev') || r.includes('engineer') || r.includes('tecnolo') || r.includes('it') || r.includes('suporte') || r.includes('ti') || r.includes('program')) {
        return { id: 'tecnologia', name: 'Tecnologia' };
      }
      if (r.includes('finance') || r.includes('admin') || r.includes('faturamento') || r.includes('contab') || r.includes('fiscal') || r.includes('compra')) {
        return { id: 'financeiro', name: 'Financeiro' };
      }
      if (r.includes('rh') || r.includes('recursos') || r.includes('human') || r.includes('talent') || r.includes('pessoal')) {
        return { id: 'recursos-humanos', name: 'Recursos Humanos' };
      }
      return { id: 'comercial', name: 'Comercial' };
    };

    const deptInfo = getIntelligentDepartment(role);

    // Associated user role permissions
    const getPermissionsForRole = (roleStr: string) => {
      const r = (roleStr || '').toLowerCase();
      if (r.includes('admin') || r.includes('diretor') || r.includes('manager') || r.includes('gerente')) {
        return {
          finance: { view: true, approve: true, delete: true },
          inventory: { view: true, adjust: true, delete: true },
          hr: { view: true, manage: true },
          tickets: { view: true, resolve: true, admin: true }
        };
      }
      if (r.includes('consultor') || r.includes('venda') || r.includes('sales')) {
        return {
          finance: { view: true, approve: false, delete: false },
          inventory: { view: true, adjust: false, delete: false },
          hr: { view: false, manage: false },
          tickets: { view: true, resolve: true, admin: false }
        };
      }
      return {
        finance: { view: false, approve: false, delete: false },
        inventory: { view: true, adjust: false, delete: false },
        hr: { view: false, manage: false },
        tickets: { view: true, resolve: false, admin: false }
      };
    };

    const permissions = getPermissionsForRole(role);

    const employeeData = {
      name,
      email,
      phone,
      documentId,
      role,
      departmentId: deptInfo.id,
      departmentName: deptInfo.name,
      status: 'onboarding',
      salary: 0,
      hiredAt: FieldValue.serverTimestamp(),
      performanceScore: 0,
      origin: 'Nexus ERP',
      virtualFolders: [
        { name: "Boletos", createdAt: new Date().toISOString(), files: [] },
        { name: "Ponto", createdAt: new Date().toISOString(), files: [] },
        { name: "Histórico", createdAt: new Date().toISOString(), files: [] }
      ],
      history: [{
        date: FieldValue.serverTimestamp(),
        event: 'Importação Nexus',
        description: `Colaborador importado e integrado de forma inteligente ao departamento ${deptInfo.name}.`
      }]
    };

    const docRef = await db.collection('employees').add(employeeData);
    const finalId = employeeIdInput || docRef.id;

    await db.collection('employees').doc(docRef.id).update({
      id: docRef.id
    });

    try {
      await db.collection('users').doc(finalId).set({
        uid: finalId,
        email: email,
        displayName: name,
        role: role.toLowerCase().includes('admin') || role.toLowerCase().includes('gerente') ? 'ADMIN' : 'OPERATOR',
        status: 'active',
        temporaryPassword: 'Nexus123!',
        mustChangePassword: true,
        permissions: permissions,
        createdAt: FieldValue.serverTimestamp()
      });
      console.log(`[HR Integration] Linked User Account created for ${email}`);
    } catch (userAccountError) {
      console.error("[HR Integration] Failed to create secondary user document:", userAccountError);
    }

    await db.collection('auditLogs').add({
      action: 'create',
      resource: 'employees',
      resourceId: docRef.id,
      userId: 'system-integration',
      userName: 'Nexus ERP Connector',
      timestamp: FieldValue.serverTimestamp(),
      changes: { after: employeeData }
    });

    res.status(201).json({ 
      status: "success", 
      employeeId: docRef.id,
      message: "Colaborador integrado com sucesso, conta criada com senha temporária Nexus123!, pastas virtuais de RH (Boletos, Ponto, Histórico) geradas."
    });
  } catch (error) {
    console.error("[HR Integration] Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * 3. Disparo de Dados de RH (Para: Nexus)
 * Proxy para enviar dados ao Nexus (evita CORS e permite tratamento centralizado).
 */
app.post("/api/integration/hr/nexus-outbound", async (req, res) => {
  try {
    const employeeData = req.body;
    let nexusUrl = process.env.NEXUS_BASE_URL;
    let nexusKey = process.env.NEXUS_API_KEY;

    if (!nexusUrl || !nexusKey) {
      const configSnap = await db.collection('system').doc('config').get();
      if (configSnap.exists) {
        const config = configSnap.data();
        nexusUrl = nexusUrl || config?.integrations?.nexusBaseUrl;
        nexusKey = nexusKey || config?.integrations?.nexusApiKey;
      }
    }

    if (!nexusUrl || !nexusKey) {
      console.warn("[AdminHub] Nexus credentials missing. Simulating successful sync.");
      await new Promise(r => setTimeout(r, 800));
      return res.status(200).json({ status: "success", message: "Simulated sync (Missing Config)" });
    }

    let endpoint = nexusUrl;
    const hasSpecificResource = endpoint.includes("/employees") || 
                                endpoint.includes("/nexus") || 
                                endpoint.includes("/hr") || 
                                endpoint.endsWith("/employee");
    
    if (!hasSpecificResource) {
      if (endpoint.endsWith("/")) {
        endpoint += "employees";
      } else {
        endpoint += "/employees";
      }
    }

    await axios.post(endpoint, employeeData, {
      headers: { 
        "Authorization": `Bearer ${nexusKey}`,
        "x-api-key": nexusKey,
        "Content-Type": "application/json"
      }
    });
    
    res.status(200).json({ status: "success", message: "Data synced with Nexus ERP" });
  } catch (error: any) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error(`[AdminHub] Outbound Sync Error (${status || 'UNKNOWN'}):`, data || error.message);
    res.status(200).json({ 
      status: "warning", 
      message: `Employee created but Nexus sync failed (${status || 'error'}).` 
    });
  }
});

// --- VITE MIDDLEWARE & STANDALONE ASSET SERVING ---

if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  }).then((vite) => {
    app.use(vite.middlewares);
    console.log("[AdminHub] Vite Dev Server middleware loaded successfully.");
  }).catch((err) => {
    console.error("[AdminHub] Vite Dev Server integration failed asynchronously:", err);
  });
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

export default app;
