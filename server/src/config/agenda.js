import Agenda from "agenda";

const agenda = new Agenda({
  db: {
    address: process.env.MONGODB_URI || "mongodb://localhost:27017/bet-app",
    collection: "agendaJobs",
  },
  processEvery: '30 seconds', // ✅ FIX: Increased from 5 to 30 seconds to reduce MongoDB query frequency and prevent event loop blocking
  maxConcurrency: 20,
  defaultConcurrency: 5,
  lockLimit: 0, // No limit on locked jobs
});

export default agenda;
