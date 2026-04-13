import { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  try {
    // Dynamically import the backend app to catch initialization errors
    const backend = await import('../backend-ts/src/index.js');
    const app = backend.default;
    
    // Pass the request to the Express app
    return app(req, res);
  } catch (error: any) {
    console.error("Vercel Serverless Init Error:", error);
    res.status(500).json({
      error: "SERVER_INIT_FAILED",
      message: error?.message || String(error),
      stack: error?.stack
    });
  }
}
