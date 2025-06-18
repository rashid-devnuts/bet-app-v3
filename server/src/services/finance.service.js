import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import mongoose from "mongoose";

class FinanceService {
  // Create a new transaction
  async createTransaction(transactionData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { userId, type, amount, description, processedBy } =
        transactionData;

      // Get user
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error("User not found");
      }

      // Calculate new balance
      let newBalance;
      if (type === "deposit") {
        newBalance = user.balance + amount;
      } else if (type === "withdraw") {
        if (user.balance < amount) {
          throw new Error("Insufficient balance");
        }
        newBalance = user.balance - amount;
      } else {
        throw new Error("Invalid transaction type");
      } // Create transaction
      const transaction = new Transaction({
        userId,
        type,
        amount,
        description,
        processedBy,
        balanceAfterTransaction: newBalance,
      });

      user.balance = newBalance;

      // Save both in transaction
      await transaction.save({ session });
      await user.save({ session });

      await session.commitTransaction();

      // Populate user data for response
      await transaction.populate([
        { path: "userId", select: "firstName lastName email" },
        { path: "processedBy", select: "firstName lastName" },
      ]);

      return transaction;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  async getTransactions(filters = {}) {
    const {
      page = 1,
      limit = 10,
      type,
      userId,
      dateFrom,
      dateTo,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filters;

    const query = {}; // Apply filters
    if (type) query.type = type;
    if (userId) query.userId = userId;

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    // Build aggregation pipeline for search
    let pipeline = [{ $match: query }];

    // Add user lookup for search
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    });

    pipeline.push({
      $unwind: "$user",
    });

    // Search filter
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { description: { $regex: search, $options: "i" } },
            { "user.firstName": { $regex: search, $options: "i" } },
            { "user.lastName": { $regex: search, $options: "i" } },
            { "user.email": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    // Add processedBy lookup
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "processedBy",
        foreignField: "_id",
        as: "processedBy",
      },
    });

    // Sort
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;
    pipeline.push({ $sort: sortObj });

    // Get total count
    const totalCountPipeline = [...pipeline, { $count: "total" }];
    const totalResult = await Transaction.aggregate(totalCountPipeline);
    const total = totalResult[0]?.total || 0;

    // Add pagination
    pipeline.push({ $skip: (page - 1) * limit });
    pipeline.push({ $limit: parseInt(limit) }); // Select fields
    pipeline.push({
      $project: {
        _id: 1,
        type: 1,
        amount: 1,
        description: 1,
        balanceAfterTransaction: 1,
        createdAt: 1,
        updatedAt: 1,
        user: {
          _id: "$user._id",
          firstName: "$user.firstName",
          lastName: "$user.lastName",
          email: "$user.email",
        },
        processedBy: {
          $cond: {
            if: { $gt: [{ $size: "$processedBy" }, 0] },
            then: {
              _id: { $arrayElemAt: ["$processedBy._id", 0] },
              firstName: { $arrayElemAt: ["$processedBy.firstName", 0] },
              lastName: { $arrayElemAt: ["$processedBy.lastName", 0] },
            },
            else: null,
          },
        },
      },
    });

    const transactions = await Transaction.aggregate(pipeline);

    return {
      transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    };
  }

  // Get transaction by ID
  async getTransactionById(id) {
    const transaction = await Transaction.findById(id).populate([
      { path: "userId", select: "firstName lastName email balance" },
      { path: "processedBy", select: "firstName lastName" },
    ]);

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    return transaction;
  }

  // Get financial summary
  async getFinancialSummary() {
    const summary = await Transaction.aggregate([
      {
        $group: {
          _id: "$type",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Get current total balance of all users
    const totalUsersBalance = await User.aggregate([
      {
        $group: {
          _id: null,
          totalBalance: { $sum: "$balance" },
        },
      },
    ]);

    const deposits = summary.find((s) => s._id === "deposit") || {
      totalAmount: 0,
      count: 0,
    };
    const withdrawals = summary.find((s) => s._id === "withdraw") || {
      totalAmount: 0,
      count: 0,
    };

    const currentBalance = totalUsersBalance[0]?.totalBalance || 0;

    // Calculate profits: Total deposits - current balance - total withdrawals
    const profits =
      deposits.totalAmount - currentBalance - withdrawals.totalAmount;

    return {
      totalDeposits: deposits.totalAmount,
      totalWithdrawals: withdrawals.totalAmount,
      currentBalance,
      profits,
      depositsCount: deposits.count,
      withdrawalsCount: withdrawals.count,
      totalTransactions: deposits.count + withdrawals.count,
    };
  }
  // Get user's transaction history
  async getUserTransactions(userId, filters = {}) {
    const userFilters = { ...filters, userId };
    return this.getTransactions(userFilters);
  }
}

export default new FinanceService();
