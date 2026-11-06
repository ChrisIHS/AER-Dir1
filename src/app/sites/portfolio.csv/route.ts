import { NextResponse } from "next/server";
import { loadPortfolio } from "@/lib/db/portfolio";
import { portfolioCsv } from "@/lib/portfolio";

/** Portfolio summary as CSV: only the sites the signed-in user has full access to. */
export async function GET() {
  const { summaries } = await loadPortfolio();
  return new NextResponse(portfolioCsv(summaries), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ssla-portfolio-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
