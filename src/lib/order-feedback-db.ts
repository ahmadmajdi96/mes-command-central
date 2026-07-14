import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProductRating {
  product_id: string;
  rating: number;
  note?: string;
}

export interface OrderFeedback {
  id: string;
  order_id: string;
  rating: number;
  category: string;
  comment: string | null;
  comments: string[];
  product_ratings: ProductRating[];
  status: "open" | "resolved";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const feedbackKey = (orderId: string) => ["order_feedback", orderId] as const;

export function useOrderFeedback(orderId: string) {
  return useQuery({
    queryKey: feedbackKey(orderId),
    queryFn: async (): Promise<OrderFeedback[]> => {
      const { data, error } = await supabase
        .from("order_feedback" as never)
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as Array<Omit<OrderFeedback, "comments" | "product_ratings"> & { comments: unknown; product_ratings: unknown }>).map((r) => ({
        ...r,
        comments: Array.isArray(r.comments) ? (r.comments as string[]) : [],
        product_ratings: Array.isArray(r.product_ratings) ? (r.product_ratings as ProductRating[]) : [],
      }));
    },
  });
}

export interface FeedbackInput {
  rating: number;
  category: string;
  comment?: string | null;
  comments?: string[];
  product_ratings?: ProductRating[];
  status?: string;
}

export function useCreateFeedback(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FeedbackInput) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("order_feedback" as never).insert({
        order_id: orderId,
        rating: input.rating,
        category: input.category,
        comment: input.comment ?? null,
        comments: input.comments ?? [],
        product_ratings: input.product_ratings ?? [],
        status: input.status ?? "open",
        created_by: userRes?.user?.id ?? null,
      } as never).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: feedbackKey(orderId) }); toast.success("Feedback added"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateFeedback(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<OrderFeedback> }) => {
      const { error } = await supabase.from("order_feedback" as never).update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: feedbackKey(orderId) }); toast.success("Feedback updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteFeedback(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("order_feedback" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: feedbackKey(orderId) }); toast.success("Feedback deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
