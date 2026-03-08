import { Loader2 } from "lucide-react";

const PageLoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

export default PageLoadingFallback;
