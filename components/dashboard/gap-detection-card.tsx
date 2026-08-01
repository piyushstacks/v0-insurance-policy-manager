'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, AlertTriangle, ArrowRight, UserPlus, RefreshCw, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function GapDetectionCard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['gap-detection'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/gap-detection');
      if (!res.ok) throw new Error('Failed to fetch gap detection data');
      return res.json();
    }
  });

  if (isError) return null;

  return (
    <Card className="rounded-2xl border border-border shadow-sm overflow-hidden h-full flex flex-col">
      <CardHeader className="border-b border-border bg-background py-4 flex flex-row items-center justify-between">
         <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            AI Gap Detection
         </CardTitle>
         <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8 w-8 p-0" title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
         </Button>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col min-h-0">
         {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted-foreground">
               <Loader2 className="w-6 h-6 animate-spin mb-3" />
               <p className="text-xs font-bold uppercase tracking-wider">Analyzing Opportunities...</p>
            </div>
         ) : data?.status === 'calculating' ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted-foreground text-center">
               <RefreshCw className="w-6 h-6 animate-spin mb-3 text-indigo-400 mx-auto" />
               <p className="text-xs font-bold uppercase tracking-wider text-foreground">Initial Scan Running</p>
               <p className="text-[10px] mt-2">Check back in a minute. We are scanning your client base for cross-sell gaps.</p>
            </div>
         ) : (
            <Tabs defaultValue="cross-sell" className="flex-1 flex flex-col w-full h-full">
               <div className="px-4 pt-3 pb-0 border-b border-border">
                  <TabsList className="grid w-full grid-cols-2 bg-muted transition-colors/80 p-1 h-10 rounded-xl">
                     <TabsTrigger value="cross-sell" className="text-xs font-bold rounded-lg data-[state=active]:bg-card transition-colors data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                        Cross-Sell ({data?.data?.crossSell?.length || 0})
                     </TabsTrigger>
                     <TabsTrigger value="at-risk" className="text-xs font-bold rounded-lg data-[state=active]:bg-card transition-colors data-[state=active]:text-rose-600 data-[state=active]:shadow-sm">
                        At Risk ({data?.data?.atRisk?.length || 0})
                     </TabsTrigger>
                  </TabsList>
               </div>
               
               <TabsContent value="cross-sell" className="flex-1 overflow-y-auto p-0 m-0 custom-scrollbar">
                  {data?.data?.crossSell?.length === 0 ? (
                     <div className="text-center py-10 px-4">
                        <UserPlus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-muted-foreground">No immediate opportunities</p>
                     </div>
                  ) : (
                     <ul className="divide-y divide-slate-50">
                        {data?.data?.crossSell?.map((item: any, i: number) => (
                           <li key={i} className="p-4 hover:bg-background transition-colors">
                              <div className="flex items-center justify-between">
                                 <div>
                                    <h4 className="text-sm font-bold text-foreground">{item.customer?.name}</h4>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-1">
                                       Has <span className="text-indigo-500">{item.existing_type}</span>
                                    </p>
                                 </div>
                                 <Link href={`/app/customers/${item.customer?.id}`} prefetch={true}>
                                    <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 px-3 rounded-lg">
                                       Pitch {item.missing_types[0] || 'Other'} <ArrowRight className="w-3 h-3 ml-1" />
                                    </Button>
                                 </Link>
                              </div>
                           </li>
                        ))}
                     </ul>
                  )}
               </TabsContent>

               <TabsContent value="at-risk" className="flex-1 overflow-y-auto p-0 m-0 custom-scrollbar">
                  {data?.data?.atRisk?.length === 0 ? (
                     <div className="text-center py-10 px-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-2">
                           <Sparkles className="w-5 h-5 text-emerald-500" />
                        </div>
                        <p className="text-xs font-bold text-muted-foreground">All renewals contacted!</p>
                     </div>
                  ) : (
                     <ul className="divide-y divide-slate-50">
                        {data?.data?.atRisk?.map((item: any, i: number) => (
                           <li key={i} className="p-4 hover:bg-rose-50/20 transition-colors">
                              <div className="flex justify-between">
                                 <div>
                                    <h4 className="text-sm font-bold text-foreground">{item.customer?.name}</h4>
                                    <div className="flex items-center gap-1.5 mt-1">
                                       <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                       <p className="text-[10px] text-rose-600 uppercase tracking-wider font-bold">
                                          Expires in {item.days_to_expiry} days (No Contact)
                                       </p>
                                    </div>
                                 </div>
                                 <Link href={`/app/policies/${item.policy_id}`} prefetch={true}>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50" title="View Policy">
                                       <ArrowRight className="w-3.5 h-3.5" />
                                    </Button>
                                 </Link>
                              </div>
                           </li>
                        ))}
                     </ul>
                  )}
               </TabsContent>
            </Tabs>
         )}
      </CardContent>
    </Card>
  );
}
