import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    type: {
      type: String,
      required: [true, "Transaction type is required"],
      enum: ["deposit", "withdraw"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than 0"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxLength: [500, "Description cannot exceed 500 characters"],
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Admin who processed the transaction
    },
    balanceAfterTransaction: {
      type: Number,
      required: false, // User's balance after this transaction
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ type: 1, createdAt: -1 });

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
