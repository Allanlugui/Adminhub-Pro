import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import axios from "axios";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

// Initialize Firebase Admin
let app: any;
try {
  if (getApps().length === 0) {
    app = initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log(`[AdminHub] Firebase Admin initialized for project: ${firebaseConfig.projectId}`);
  } else {
    app = getApps()[0];
  }
} catch (error) {
  console.error("[AdminHub] Critical failure initializing Firebase Admin:", error);
}

// Explicitly pass the app reference and database ID
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = 3000;

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
    res.json({ status: "alive", timestamp: new Date().toISOString() });
  });

  // --- AUTH MIDDLEWARE FOR INTEGRATIONS ---
  // This middleware verifies the secret shared key (X-API-Key)
  // treating valid requests as "Trusted Origin" without requiring user session
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
        // If Firestore fails (e.g. Project ID error), we can't fall back
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
      // Support both English and Portuguese fields for integration flexibility
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

      console.log(`[Finance Integration] Success: New transaction registered ${docRef.id}`);
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
      // Support both English and Portuguese fields for integration flexibility
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

        // Permanent Log for Integration Failure (as requested for active auditing)
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
      const existing = await db.collection('employees').where('email', '==', email).limit(1).get();
      if (!existing.empty) {
        return res.status(200).json({ status: "exists", id: existing.docs[0].id });
      }

      // Intelligent Department Mapping if none supplied
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
        return { id: 'comercial', name: 'Comercial' }; // Map as default Comercial, e.g. Consultor Nexus is Comercial
      };

      const deptInfo = getIntelligentDepartment(role);

      // Associated user role permissions based on role (papel)
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
        // Configure virtual folders automatically for the new employee (Boletos, Ponto, Histórico)
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

      // Add to employees collection
      const docRef = await db.collection('employees').add(employeeData);
      const finalId = employeeIdInput || docRef.id;

      // Update employee document to make sure it includes ID inside if it didn't
      await db.collection('employees').doc(docRef.id).update({
        id: docRef.id
      });

      // Create linked user profile with standard temporary password (Nexus123!)
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
        console.log(`[HR Integration] Linked User Account created for ${email} with password Nexus123!`);
      } catch (userAccountError) {
        console.error("[HR Integration] Failed to create secondary user document, skipping but employee is active:", userAccountError);
      }

      // Audit Log for successful synchronization
      await db.collection('auditLogs').add({
        action: 'create',
        resource: 'employees',
        resourceId: docRef.id,
        userId: 'system-integration',
        userName: 'Nexus ERP Connector',
        timestamp: FieldValue.serverTimestamp(),
        changes: { after: employeeData }
      });

      console.log(`[HR Integration] Success: New employee integrated from Nexus ${docRef.id}`);
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

      // Fallback to DB
      if (!nexusUrl || !nexusKey) {
        console.log("[AdminHub] Attempting to fetch Nexus config from Firestore...");
        const configSnap = await db.collection('system').doc('config').get();
        if (configSnap.exists) {
          const config = configSnap.data();
          nexusUrl = nexusUrl || config?.integrations?.nexusBaseUrl;
          nexusKey = nexusKey || config?.integrations?.nexusApiKey;
        }
      }

      console.log(`[AdminHub] Outbound Sync Attempt for: ${employeeData.name}`);

      if (!nexusUrl || !nexusKey) {
        console.warn("[AdminHub] Nexus credentials missing in Env and DB. Simulating successful sync.");
        await new Promise(r => setTimeout(r, 800));
        return res.status(200).json({ status: "success", message: "Simulated sync (Missing Config)" });
      }

      let endpoint = nexusUrl;
      // Dynamically determine the endpoint. If NEXUS_BASE_URL already contains the full path/resource, use it.
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

      console.log(`[AdminHub] Calling Nexus API: ${endpoint}`);

      await axios.post(endpoint, employeeData, {
        headers: { 
          "Authorization": `Bearer ${nexusKey}`,
          "x-api-key": nexusKey,
          "Content-Type": "application/json"
        }
      });
      
      console.log(`[AdminHub] Successfully synced with Nexus: ${employeeData.name}`);
      res.status(200).json({ status: "success", message: "Data synced with Nexus ERP" });
    } catch (error: any) {
      const status = error.response?.status;
      const data = error.response?.data;
      console.error(`[AdminHub] Outbound Sync Error (${status || 'UNKNOWN'}):`, data || error.message);
      
      // Fallback: Even if sync fails, we return 200 to not block the UI but log the error
      res.status(200).json({ 
        status: "warning", 
        message: `Employee created but Nexus sync failed (${status || 'error'}).` 
      });
    }
  });

  // --- VITE MIDDLEWARE ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
