import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Terminal, 
  ShieldAlert, 
  MessageSquareHeart, 
  Dices, 
  Settings2, 
  Sparkles,
  Gamepad2,
  ChevronRight,
  ArrowRight
} from "lucide-react";

const INVITE_URL = "https://discord.com/api/oauth2/authorize?client_id=1507776524189827242&permissions=1099780090886&scope=bot%20applications.commands";

const ROW_1 = ['/ping','/hello','/bye','/botinfo','/userinfo','/serverinfo','/avatar','/roleinfo','/roll','/poll','/poll_choice','/setwelcome','/clearwelcome','/welcometest','/coinflip','/8ball','/joke','/fact','/rps','/choose','/rate'];
const ROW_2 = ['/kick','/ban','/softban','/unban','/banlist','/timeout','/untimeout','/clear','/slowmode','/lock','/unlock','/nick','/addrole','/removerole','/announce','/setwarnrole','/warn','/warnings','/clearwarnings','/ship','/roast'];
const ROW_3 = ['/compliment','/mock','/reverse','/would_you_rather','/trivia','/number_guess','/slots','/pp','/iq','/sus','/hug','/slap','/pat','/clap','/emojify','/quote','/pickup','/dare','/truth','/fortune','/hack','/passwordgen','/ascii_art','/encode','/decode','/typerace','/roll_stats','/love_letter','/battle'];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30">
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-white">
              A
            </div>
            <span className="font-bold text-xl tracking-tight">Apex</span>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-primary transition-colors hidden md:block">Features</a>
            <a href="#commands" className="hover:text-primary transition-colors hidden md:block">Commands</a>
            <Button size="sm" variant="outline" asChild className="rounded-full font-bold">
              <a href="/dashboard">
                Dashboard
              </a>
            </Button>
            <Button size="sm" asChild className="rounded-full font-bold">
              <a href={INVITE_URL} target="_blank" rel="noreferrer">
                Add to Server
              </a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/30 rounded-full blur-[120px]" />
          <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-accent/20 rounded-full blur-[100px]" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 text-center md:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-mono mb-6 border border-border">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Apex#1673 is online
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-tight">
                The <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Ultimate</span><br />
                Discord Companion.
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto md:mx-0">
                Moderation, entertainment, polls, and fun games to supercharge your server. Built by people who actually use Discord.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start">
                <Button size="lg" className="h-14 px-8 text-lg rounded-full font-bold w-full sm:w-auto shadow-lg shadow-primary/20" asChild>
                  <a href={INVITE_URL} target="_blank" rel="noreferrer">
                    Invite Apex Free <ArrowRight className="ml-2 w-5 h-5" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full font-bold w-full sm:w-auto bg-transparent border-2">
                  <a href="#commands">View Commands</a>
                </Button>
              </div>
            </motion.div>
          </div>
          
          <motion.div 
            className="flex-1 relative w-full max-w-lg mx-auto"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="aspect-square rounded-3xl overflow-hidden accent-glow border border-border/50 bg-secondary relative">
              <img 
                src="/hero.png" 
                alt="Apex Bot Abstract Tech Visual" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-background/80 to-transparent mix-blend-overlay" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories / Features */}
      <section id="features" className="py-24 bg-secondary/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Everything you need. <br />Nothing you don't.</h2>
            <p className="text-muted-foreground text-lg">
              With 50+ slash commands across 6 core categories, Apex brings exactly what your community craves.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<ShieldAlert className="w-8 h-8 text-primary" />}
              title="Moderation & Warnings"
              desc="Keep your server safe with robust mod tools, warning systems, and auto-logging."
            />
            <FeatureCard 
              icon={<MessageSquareHeart className="w-8 h-8 text-accent" />}
              title="Welcome System"
              desc="Give new members a warm entrance with customizable welcome messages and roles."
            />
            <FeatureCard 
              icon={<Gamepad2 className="w-8 h-8 text-pink-500" />}
              title="Entertainment & Games"
              desc="Slots, typeracer, battles, and more to keep your community engaged for hours."
            />
            <FeatureCard 
              icon={<Dices className="w-8 h-8 text-yellow-500" />}
              title="Polls & Dice"
              desc="Easily gather opinions or roll the dice for tabletop games right in chat."
            />
            <FeatureCard 
              icon={<Settings2 className="w-8 h-8 text-blue-500" />}
              title="Utility & Info"
              desc="Password generators, text encoders, ascii art, and server information at your fingertips."
            />
            <FeatureCard 
              icon={<Sparkles className="w-8 h-8 text-purple-500" />}
              title="Social & Fun"
              desc="Hug, slap, pat, send love letters, or check someones 'sus' level."
            />
          </div>
        </div>
      </section>

      {/* Marquee Commands */}
      <section id="commands" className="py-24 overflow-hidden relative">
        <div className="container mx-auto px-4 mb-12 text-center">
          <h2 className="text-3xl font-bold">61 Slash Commands</h2>
          <p className="text-muted-foreground mt-2">Just type <code className="bg-secondary px-2 py-1 rounded text-primary font-mono">/</code> to get started.</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex gap-4 animate-[scroll_40s_linear_infinite] w-max px-4">
            {ROW_1.concat(ROW_1).map((cmd, i) => <CommandBadge key={i} cmd={cmd} />)}
          </div>
          <div className="flex gap-4 animate-[scroll-reverse_45s_linear_infinite] w-max px-4 -ml-24">
            {ROW_2.concat(ROW_2).map((cmd, i) => <CommandBadge key={i} cmd={cmd} />)}
          </div>
          <div className="flex gap-4 animate-[scroll_35s_linear_infinite] w-max px-4">
            {ROW_3.concat(ROW_3).map((cmd, i) => <CommandBadge key={i} cmd={cmd} />)}
          </div>
        </div>

        <style>{`
          @keyframes scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(calc(-50% - 0.5rem)); }
          }
          @keyframes scroll-reverse {
            0% { transform: translateX(calc(-50% - 0.5rem)); }
            100% { transform: translateX(0); }
          }
        `}</style>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4 relative z-10">
          <div className="bg-gradient-to-br from-secondary to-background border border-border rounded-3xl p-8 md:p-16 text-center max-w-4xl mx-auto shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px]" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/20 rounded-full blur-[80px]" />
            
            <h2 className="text-4xl md:text-6xl font-black mb-6 relative z-10">Ready to level up your server?</h2>
            <p className="text-xl text-muted-foreground mb-10 relative z-10">
              Join thousands of servers using Apex. It's completely free to add.
            </p>
            <Button size="lg" className="h-16 px-10 text-xl rounded-full font-bold shadow-lg hover:scale-105 transition-transform relative z-10" asChild>
              <a href={INVITE_URL} target="_blank" rel="noreferrer">
                Add Apex to Discord <ChevronRight className="ml-2 w-6 h-6" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center font-bold text-white text-xs">
              A
            </div>
            <span className="font-bold text-lg">Apex Bot</span>
          </div>
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Apex. Not affiliated with Discord Inc.
          </p>
        </div>
      </footer>
      
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <Card className="bg-background/50 border border-border/50 p-6 rounded-2xl hover:border-primary/50 transition-colors group">
      <div className="mb-4 p-3 bg-secondary/50 rounded-xl inline-block group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">
        {desc}
      </p>
    </Card>
  );
}

function CommandBadge({ cmd }: { cmd: string }) {
  return (
    <div className="flex items-center gap-2 bg-secondary border border-border px-5 py-3 rounded-xl shadow-sm min-w-max">
      <Terminal className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="font-mono font-semibold text-base">{cmd}</span>
    </div>
  );
}
