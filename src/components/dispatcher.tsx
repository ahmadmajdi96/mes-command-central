import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const portrait = "/brand/dispatcher.webp";
const signature = "Make the delivery promise match the plan.";

function DispatcherPortrait({ className }: { className: string }) {
  return (
    <img
      src={portrait}
      alt="Dispatcher, the cobalt-blue order management robot"
      width={720}
      height={958}
      decoding="async"
      className={className}
    />
  );
}

export function DispatcherBanner() {
  return (
    <aside
      aria-labelledby="dispatcher-heading"
      className="oms-brand-stage flex items-center justify-between gap-4 rounded-xl px-4 py-3 sm:gap-7 sm:px-6"
    >
      <div className="min-w-0">
        <h2 id="dispatcher-heading" className="text-sm font-semibold text-dispatcher">
          Dispatcher
        </h2>
        <p className="mt-1 text-base font-semibold leading-snug sm:text-xl">{signature}</p>
        <Link
          to="/exceptions"
          className="mt-1 inline-block text-sm text-dispatcher underline-offset-4 hover:underline focus-visible:underline"
        >
          Review order exceptions
        </Link>
      </div>
      <DispatcherPortrait className="size-16 shrink-0 rounded-lg border border-ivory/15 object-cover object-[50%_36%] sm:size-24" />
    </aside>
  );
}

export function DispatcherPresence() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Meet Dispatcher"
          className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-sidebar-border p-1.5 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:p-0"
        >
          <img
            src={portrait}
            alt=""
            width={36}
            height={36}
            decoding="async"
            className="size-9 shrink-0 rounded-md object-cover object-[50%_29%]"
          />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
            Dispatcher
          </span>
          <ArrowUpRight
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
          />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto motion-reduce:animate-none">
        <DialogTitle className="pr-10">Meet Dispatcher</DialogTitle>
        <DialogDescription>Order guidance from availability through shipment.</DialogDescription>
        <div className="oms-brand-stage flex items-center gap-4 rounded-xl p-4">
          <DispatcherPortrait className="w-20 shrink-0 rounded-lg sm:w-28" />
          <p className="text-lg font-semibold leading-tight text-ivory">{signature}</p>
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-semibold">Check the commitment</dt>
            <dd className="text-muted-foreground">
              Check confirmed availability and the requested date before updating the customer.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Route the exception</dt>
            <dd className="text-muted-foreground">
              Review the affected order, assign the next owner, and confirm the next update.
            </dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
