/** Demo table（课程示例，仍保留） */
export const DEMO_TABLE_NAME = "course_demo_items" as const;

export type DemoItem = {
  id: number;
  title: string;
  created_at: string;
};

/** 运单业务表 */
export const SHIPPING_ORDERS_TABLE = "shipping_orders" as const;
