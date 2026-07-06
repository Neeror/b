import mongoose from "mongoose"

const RETRY_COUNT     = 3
const BASE_DELAY_MS   = 2000 

function redactUri(uri: string): string {
  return uri.replace(/\/\/([^@/]+)@/, "//***:***@")
}

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error("MONGODB_URI is not set in environment variables")

  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        autoIndex: process.env.NODE_ENV !== "production",
      })
      console.info(`[DB] Connected to ${redactUri(uri)} (attempt ${attempt})`)
      return
    } catch (err) {
      if (attempt === RETRY_COUNT) {
        const reason = err instanceof Error ? err.message : "unknown error"
        throw new Error(`[DB] Failed to connect after ${RETRY_COUNT} attempts: ${redactUri(reason)}`)
      }
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1)
      console.warn(`[DB] Attempt ${attempt} failed, retrying in ${delay}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect()
  console.info("[DB] Disconnected")
}

mongoose.connection.on("disconnected", () => {
  console.warn("[DB] Connection lost")
})

mongoose.connection.on("error", (err) => {
  console.error("[DB] Error:", err instanceof Error ? err.message : "unknown")
})
