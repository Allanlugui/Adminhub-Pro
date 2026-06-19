import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import axios from "axios";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore(firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  
  // CORS configuration for integrations
  // Allows the AdminHub to be reached by external systems like the store or Nexus
  app.use("/api/integration", cors());

  // --- AUTH MIDDLEWARE FOR INTEGRATIONS ---
  // This middleware verifies the secret shared key (X-API-Key)
  // treating valid requests as "Trusted Origin" without requiring user session
  const apiKeyMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const providedKey = req.header("X-API-Key");
    
    // 1. Try Env Var
    let requiredKey = process.env.ADMINHUB_API_KEY;

    // 2. Fallback to DB
    if (!requiredKey) {
      const configSnap = await db.collection('system').doc('config').get();
      if (configSnap.exists) {
        requiredKey = configSnap.data()?.integrations?.adminHubApiKey;
      }
    }

    if (!requiredKey) {
      console.error("[Auth] ADMINHUB_API_KEY is not defined in environment or database.");
      return res.status(500).json({ error: "Server authentication misconfigured." });
    }

    if (providedKey !== requiredKey) {
      console.warn(`[Auth] Unauthorized access attempt with key: ${providedKey?.substring(0, 8)}...`);
      return res.status(401).json({ error: "Unauthorized: Invalid or missing API Key." });
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
      const { 
        value, 
        origin, 
        sector, 
        date, 
        transactionStatus, 
        auditStatus 
      } = req.body;

      if (!value || !origin) {
        return res.status(400).json({ error: "Missing required fields: value and origin are mandatory." });
      }

      const transactionData = {
        title: `Venda: ${origin}`,
        amount: parseFloat(value),
        type: 'income',
        category: 'Sales',
        costCenter: sector || 'Retail',
        date: date ? Timestamp.fromDate(new Date(date)) : FieldValue.serverTimestamp(),
        status: transactionStatus || 'pending_approval',
        auditStatus: auditStatus || 'pending',
        origin: origin,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        notes: "Automated entry from Loja Dicas by Ale integration."
      };

      const docRef = await db.collection('transactions').add(transactionData);

      // Audit Log
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
   * Recebe cadastros de funcionários vindos do ERP Nexus.
   */
  app.post("/api/integration/hr/nexus", apiKeyMiddleware, async (req, res) => {
    try {
      const { name, email, phone, documentId, role } = req.body;

      if (!name || !email) {
        return res.status(400).json({ error: "Missing required fields: name and email." });
      }

      // Check if employee already exists by email
      const existing = await db.collection('employees').where('email', '==', email).limit(1).get();
      if (!existing.empty) {
        return res.status(200).json({ status: "exists", id: existing.docs[0].id });
      }

      const employeeData = {
        name,
        email,
        phone: phone || '',
        documentId: documentId || '',
        role: role || 'Colaborador',
        departmentId: 'nexus-sync',
        departmentName: 'Sincronizado (Nexus)',
        status: 'onboarding',
        salary: 0,
        hiredAt: FieldValue.serverTimestamp(),
        performanceScore: 0,
        origin: 'Nexus ERP',
        history: [{
          date: FieldValue.serverTimestamp(),
          event: 'Importação Nexus',
          description: 'Colaborador importado automaticamente via integração bidirecional com Nexus ERP.'
        }]
      };

      const docRef = await db.collection('employees').add(employeeData);

      // Audit Log
      await db.collection('auditLogs').add({
        action: 'create',
        resource: 'employees',
        resourceId: docRef.id,
        userId: 'system-integration',
        userName: 'Nexus ERP Connector',
        timestamp: FieldValue.serverTimestamp(),
        changes: { after: employeeData }
      });

      console.log(`[HR Integration] Success: New employee imported from Nexus ${docRef.id}`);
      res.status(201).json({ status: "success", employeeId: docRef.id });
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
        const configSnap = await db.collection('system').doc('config').get();
        if (configSnap.exists) {
          const config = configSnap.data();
          nexusUrl = nexusUrl || config?.integrations?.nexusBaseUrl;
          nexusKey = nexusKey || config?.integrations?.nexusApiKey;
        }
      }

      if (!nexusUrl || !nexusKey) {
        console.warn("[HR Outbound] Nexus credentials missing in Env and DB. Simulating successful sync.");
        await new Promise(r => setTimeout(r, 800));
        return res.status(200).json({ status: "success", message: "Simulated sync (Missing Config)" });
      }

      await axios.post(`${nexusUrl}/employees`, employeeData, {
        headers: { 
          "Authorization": `Bearer ${nexusKey}`,
          "Content-Type": "application/json"
        }
      });
      
      console.log("[HR Outbound] Successfully synced with Nexus:", employeeData.name);
      res.status(200).json({ status: "success", message: "Data synced with Nexus ERP" });
    } catch (error) {
      console.error("[HR Outbound] Error syncing with Nexus:", error);
      // Fallback: Even if sync fails, we return 200 to not block the UI but log the error
      res.status(200).json({ status: "warning", message: "Employee created but Nexus sync failed." });
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
