import express from "express";
import financeController from "../controllers/finance.controller.js";

const router = express.Router();

// Transaction routes
router.post("/transactions", financeController.createTransaction);
router.get("/transactions", financeController.getTransactions);
router.get("/transactions/:id", financeController.getTransactionById);

// Financial summary route
router.get("/summary", financeController.getFinancialSummary);

// User-specific transaction routes
router.get(
  "/users/:userId/transactions",
  financeController.getUserTransactions
);

export default router;
