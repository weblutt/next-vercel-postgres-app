/** Demo table name (must match SQL in API routes). */
export const DEMO_TABLE_NAME = "course_demo_items" as const;

export type DemoItem = {
  id: number;
  title: string;
  created_at: string;
};
