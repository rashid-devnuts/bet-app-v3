import "dotenv/config";
import connectDB from "../config/database.js";
import Bet from "../models/Bet.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import mongoose from "mongoose";

const USER_ID = process.argv[2] || "69838b3ffdb34354f59aadce";
const DATE_STR = process.argv[3] || "2026-02-04";

function startOfDay(dateStr) {
  const d = new Date(dateStr);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function endOfDay(dateStr) {
  const d = new Date(dateStr);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

async function run() {
  await connectDB();
  const userIdObj = new mongoose.Types.ObjectId(USER_ID);
  const dayStart = startOfDay(DATE_STR);
  const dayEnd = endOfDay(DATE_STR);

  const user = await User.findById(userIdObj).select("balance firstName lastName email");
  if (!user) {
    console.error("User not found:", USER_ID);
    process.exit(1);
  }

  const betsOnDay = await Bet.find({
    userId: userIdObj,
    $or: [
      { matchDate: { $gte: dayStart, $lte: dayEnd } },
      { createdAt: { $gte: dayStart, $lte: dayEnd } },
    ],
  })
    .sort({ createdAt: 1 })
    .lean();

  const transactions = await Transaction.find({ userId: userIdObj })
    .sort({ createdAt: 1 })
    .lean();

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("USER");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  ID:", user._id.toString());
  console.log("  Name:", user.firstName, user.lastName);
  console.log("  Email:", user.email);
  console.log("  Current balance:", user.balance);
  console.log("  Date filter:", DATE_STR);
  console.log("");

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("BETS ON THIS DAY (matchDate or createdAt):", betsOnDay.length);
  console.log("═══════════════════════════════════════════════════════════════");

  let totalStakes = 0,
    totalWon = 0,
    totalRefunds = 0;
  const statusCounts = {};

  betsOnDay.forEach((bet, i) => {
    const stake = bet.stake || 0;
    const payout = bet.payout || 0;
    const status = (bet.status || "pending").toLowerCase();
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    totalStakes += stake;

    let effect = -stake;
    if (status === "won" || status === "half_won") {
      totalWon += payout;
      effect += payout;
    } else if (["cancelled", "canceled", "void"].includes(status)) {
      totalRefunds += stake;
      effect += stake;
    } else if (status === "half_lost") {
      totalRefunds += stake / 2;
      effect += stake / 2;
    }

    console.log(
      `  ${i + 1}. ${bet._id} | ${(bet.teams || bet.matchId || "").slice(0, 40)} | stake=${stake} payout=${payout} status=${bet.status} | balanceEffect=${round2(effect)}`
    );
  });

  console.log("\n  --- Totals for this day ---");
  console.log("  Total stakes (placed):    ", round2(totalStakes));
  console.log("  Total won (payouts):      ", round2(totalWon));
  console.log("  Total refunds (cancelled):", round2(totalRefunds));
  console.log("  Status counts:            ", statusCounts);
  console.log("");

  let totalDeposits = 0,
    totalWithdrawals = 0;
  transactions.forEach((t) => {
    if (t.type === "deposit") totalDeposits += t.amount || 0;
    else if (t.type === "withdraw") totalWithdrawals += t.amount || 0;
  });

  const assumedStart = 10000;
  const expectedNoRefunds = assumedStart - 300 + 144.7;
  const expectedWithRefunds = assumedStart - totalStakes + totalWon + totalRefunds;

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("WHY BALANCE = 10019.40?");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Your formula (no refunds): 10000 - 300 + 144.7 =", round2(expectedNoRefunds));
  console.log("  With cancelled refunds:   ", assumedStart, "-", totalStakes, "+", totalWon, "+", totalRefunds, "=", round2(expectedWithRefunds));
  console.log("  Current balance:          ", user.balance);
  console.log("  Deposits (all time):      ", round2(totalDeposits));
  console.log("  Withdrawals (all time):   ", round2(totalWithdrawals));
  console.log("");
  const gap = round2(user.balance - expectedNoRefunds);
  console.log("  Gap vs 9844.7:", gap, "→ Explained by cancelled refunds?", Math.abs(gap - totalRefunds) < 0.02 ? "YES ✅" : "NO");
  console.log("");

  if (transactions.length > 0) {
    console.log("  Transactions:");
    transactions.forEach((t, i) => {
      console.log(`    ${i + 1}. ${t.createdAt?.toISOString?.()} ${t.type} ${t.amount} balanceAfter=${t.balanceAfterTransaction}`);
    });
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
