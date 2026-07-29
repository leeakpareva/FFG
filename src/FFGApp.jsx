import React, { useState, useEffect } from "react";
import {
  Home, Users, Calendar, Banknote, User, Heart, MessageCircle, Share2,
  MapPin, ArrowUpRight, Bell, Search, Bookmark, ChevronRight,
  Zap, TrendingUp, Handshake, Plus, BadgeCheck, ChevronLeft, MoreHorizontal,
  Grid3x3, Award, Mic, Trophy, Briefcase, Quote, Send, X, Bot,
  Radio, Hand, MicOff, LogOut, Clock, CalendarCheck, ArrowRight, Check,
  Linkedin, Instagram, Globe, Twitter, Rocket, ImagePlus, BookOpen, Ticket, QrCode
} from "lucide-react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { createApi, validateImage, ACCEPTED_IMAGE_TYPES } from "./api.js";
import { useViewport } from "./useViewport.js";
import SignInGate from "./SignInGate.jsx";
import DesktopRail from "./DesktopRail.jsx";
import { readFlag, writeFlag, readJSON, writeJSON } from "./persist.js";

const LOGO_DARK_MARK = "data:image/png;base64,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";

/* ---------- design tokens ---------- */
/**
 * Light is the only theme. The dark palette and its light-on-dark logo were
 * removed at the client's request — see git history if it is ever revived.
 */
const LIGHT = {
  mode: "light",
  ink: "#F7F4EE",
  ink2: "#FFFFFF",
  card: "#FFFFFF",
  line: "#E5E1D6",
  cream: "#17171B",
  dim: "#8A867C",
  gold: "#A8894E",
  goldSoft: "#8A6F3C",
  connect: "#5E7A94",
  community: "#4F7A62",
  logo: LOGO_DARK_MARK,
};

let T = LIGHT;

/* ---------- zodiac particle field ---------- */
const ZodiacField = ({ density = 42, opacity = 1, color = "200, 168, 103" }) => {
  const ref = React.useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, stars = [], raf, running = true;

    const seed = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.max(1, w * dpr); canvas.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.floor(density * (w * h) / (400 * 800));
      stars = Array.from({ length: Math.max(20, count) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.5 + 0.4,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        phase: Math.random() * Math.PI * 2,
      }));
    };
    seed();
    const ro = new ResizeObserver(() => seed());
    ro.observe(canvas);

    const tick = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      // connection lines (constellation feel)
      ctx.lineWidth = 0.5;
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x, dy = stars[i].y - stars[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 120) {
            const a = (1 - d / 120) * 0.35 * opacity;
            ctx.strokeStyle = `rgba(${color}, ${a})`;
            ctx.beginPath();
            ctx.moveTo(stars[i].x, stars[i].y);
            ctx.lineTo(stars[j].x, stars[j].y);
            ctx.stroke();
          }
        }
      }
      // stars
      stars.forEach(s => {
        s.x += s.vx; s.y += s.vy; s.phase += 0.018;
        if (s.x < -10) s.x = w + 10; if (s.x > w + 10) s.x = -10;
        if (s.y < -10) s.y = h + 10; if (s.y > h + 10) s.y = -10;
        const twinkle = Math.sin(s.phase) * 0.35 + 0.65;
        const a = twinkle * opacity;
        ctx.fillStyle = `rgba(${color}, ${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        // faint halo on brighter stars
        if (s.r > 1.2) {
          const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 5);
          grad.addColorStop(0, `rgba(${color}, ${a * 0.5})`);
          grad.addColorStop(1, `rgba(${color}, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [density, opacity, color]);
  return <canvas ref={ref} style={{
    position: "absolute", inset: 0, width: "100%", height: "100%",
    pointerEvents: "none", zIndex: 0,
  }} />;
};



const PILLAR = {
  Capital: { k: "gold", icon: Banknote },
  Community: { k: "community", icon: Users },
  Connect: { k: "connect", icon: Handshake },
};

const font = document.createElement("link");
font.rel = "stylesheet";
font.href = "https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;900&family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;1,500&display=swap";
document.head.appendChild(font);

/* ---------- users ---------- */
const USERS = {
  LA: {
    id: "LA", me: true, name: "Leslie A.", handle: "leslie.a", verified: true,
    role: "Founder · NAVADA", pillar: "Capital",
    bio: "Building the technology behind FFG Digital. From access to ownership.",
    posts: 24, followers: "1,204", following: 318,
    highlights: [
      { icon: Zap, label: "Builds" }, { icon: Mic, label: "Talks" }, { icon: Trophy, label: "Wins" },
    ],
    tiles: [
      { k: "stat", v: "16", l: "founders powered", c: "gold" },
      { k: "quote", v: "Own the rails, not just the ride.", c: "connect" },
      { k: "icon", icon: Zap, l: "FFG Digital build log", c: "gold" },
      { k: "stat", v: "£3M+", l: "portfolio scenario", c: "community" },
      { k: "icon", icon: Mic, l: "AI for Founders Lab", c: "connect" },
      { k: "quote", v: "Ship weekly. Review monthly.", c: "gold" },
    ],
  },
  FF: {
    id: "FF", name: "Forbes Family Group", handle: "forbesfamilygroup", verified: true,
    role: "Organisation · London", pillar: "Community",
    bio: "Opening doors across Capital, Community and Connect. 10,000+ people supported. £1M+ raised for causes.",
    posts: 148, followers: "750K", following: 210,
    highlights: [
      { icon: Banknote, label: "Capital" }, { icon: Users, label: "Community" }, { icon: Handshake, label: "Connect" },
    ],
    tiles: [
      { k: "stat", v: "10K+", l: "people supported", c: "gold" },
      { k: "stat", v: "150+", l: "events hosted", c: "community" },
      { k: "stat", v: "£1M+", l: "raised for causes", c: "gold" },
      { k: "icon", icon: Award, l: "Cohort one open", c: "connect" },
      { k: "quote", v: "From access to ownership.", c: "gold" },
      { k: "stat", v: "16", l: "founders backed", c: "community" },
    ],
  },
  FE: {
    id: "FE", name: "FFG Events", handle: "ffg.events", verified: true,
    role: "Events · UK wide", pillar: "Community",
    bio: "Rooms where things actually happen. Breakfasts, labs and pitch nights for the FFG community.",
    posts: 86, followers: "42.3K", following: 95,
    highlights: [{ icon: Calendar, label: "Upcoming" }, { icon: Users, label: "Recaps" }],
    tiles: [
      { k: "icon", icon: Calendar, l: "Founders' Breakfast", c: "community" },
      { k: "icon", icon: Mic, l: "Pitch Practice Night", c: "gold" },
      { k: "stat", v: "150+", l: "events hosted", c: "connect" },
      { k: "quote", v: "No panels. Real conversations.", c: "community" },
      { k: "icon", icon: Zap, l: "AI for Founders Lab", c: "connect" },
      { k: "stat", v: "30", l: "seats · Shoreditch", c: "gold" },
    ],
  },
  AO: {
    id: "AO", name: "Amara Osei", handle: "amara.builds", verified: true,
    role: "Founder · Kindred Labs", pillar: "Connect",
    bio: "Building AI hiring without bias. FFG cohort founder. Mentored, matched and shipping.",
    posts: 63, followers: "8,912", following: 402,
    highlights: [{ icon: Briefcase, label: "Kindred" }, { icon: Trophy, label: "Wins" }],
    tiles: [
      { k: "stat", v: "£310K", l: "seed raised", c: "gold" },
      { k: "quote", v: "Hire for signal, not familiarity.", c: "connect" },
      { k: "icon", icon: Handshake, l: "Mentor match story", c: "community" },
      { k: "stat", v: "1st", l: "corporate pilot", c: "gold" },
      { k: "icon", icon: Zap, l: "Product demo day", c: "connect" },
      { k: "quote", v: "This is your sign.", c: "community" },
    ],
  },
  KB: {
    id: "KB", name: "Kwame Boateng", handle: "kwame.gowave", verified: false,
    role: "Founder · GoWave", pillar: "Capital",
    bio: "Payments for diaspora businesses. Advise. Power. Own — living it.",
    posts: 41, followers: "5,330", following: 287,
    highlights: [{ icon: TrendingUp, label: "GoWave" }],
    tiles: [
      { k: "stat", v: "£240K", l: "raised", c: "gold" },
      { k: "icon", icon: TrendingUp, l: "Term sheet signed", c: "gold" },
      { k: "quote", v: "Advise. Power. Own. It's real.", c: "connect" },
      { k: "stat", v: "Seed", l: "stage", c: "community" },
      { k: "icon", icon: Banknote, l: "Data platform launch", c: "gold" },
      { k: "quote", v: "Community is leverage.", c: "community" },
    ],
  },
  SF: {
    id: "SF", name: "Simone Frazier", handle: "simone.gowave", verified: false,
    role: "Fintech founder · GoWave", pillar: "Capital",
    bio: "Co-building GoWave. Payments nerd. Ask me about diaspora rails.",
    posts: 29, followers: "3,108", following: 190,
    highlights: [{ icon: Briefcase, label: "GoWave" }],
    tiles: [
      { k: "icon", icon: Banknote, l: "Rails deep-dive", c: "gold" },
      { k: "quote", v: "Payments are a trust business.", c: "connect" },
      { k: "stat", v: "94", l: "match score", c: "community" },
      { k: "icon", icon: Handshake, l: "Office hours", c: "connect" },
      { k: "stat", v: "£240K", l: "raised", c: "gold" },
      { k: "quote", v: "Build boring. Win big.", c: "community" },
    ],
  },
  NC: {
    id: "NC", name: "Naomi Clarke", handle: "naomi.brand", verified: true,
    role: "Mentor · Brand strategy", pillar: "Connect",
    bio: "Brand strategist. 12 founders mentored this quarter. Office hours Fridays.",
    posts: 57, followers: "11.6K", following: 512,
    highlights: [{ icon: Award, label: "Mentoring" }, { icon: Mic, label: "Talks" }],
    tiles: [
      { k: "stat", v: "12", l: "founders mentored", c: "connect" },
      { k: "quote", v: "Clarity beats cleverness.", c: "gold" },
      { k: "icon", icon: Mic, l: "Brand clinic recap", c: "community" },
      { k: "icon", icon: Award, l: "Mentor of the month", c: "gold" },
      { k: "quote", v: "Positioning is a promise.", c: "connect" },
      { k: "stat", v: "Fri", l: "office hours", c: "community" },
    ],
  },
  MJ: {
    id: "MJ", name: "Marcus Junior", handle: "marcus.angel", verified: false,
    role: "Angel · ex-Google", pillar: "Capital",
    bio: "Backing pre-seed founders others overlook. Warm intros via FFG Connect.",
    posts: 18, followers: "6,742", following: 133,
    highlights: [{ icon: Banknote, label: "Portfolio" }],
    tiles: [
      { k: "stat", v: "9", l: "companies backed", c: "gold" },
      { k: "quote", v: "Bet on obsession.", c: "connect" },
      { k: "icon", icon: Banknote, l: "Pre-seed thesis", c: "gold" },
      { k: "stat", v: "91", l: "match score", c: "community" },
      { k: "icon", icon: Handshake, l: "Founder AMA", c: "connect" },
      { k: "quote", v: "Speed is a moat.", c: "gold" },
    ],
  },
  DJ: {
    id: "DJ", name: "Deji Adeyemi", handle: "deji.rootrise", verified: false,
    role: "Founder · Root & Rise", pillar: "Community",
    bio: "Building Root & Rise — a wellness marketplace for our communities. FFG powered, pre-seed.",
    posts: 34, followers: "4,205", following: 356,
    highlights: [{ icon: Briefcase, label: "Root & Rise" }],
    tiles: [
      { k: "stat", v: "£85K", l: "raised", c: "gold" },
      { k: "quote", v: "Wellness is wealth.", c: "community" },
      { k: "icon", icon: Zap, l: "Marketplace beta", c: "connect" },
      { k: "stat", v: "Pre", l: "seed stage", c: "gold" },
      { k: "icon", icon: Users, l: "Community launch", c: "community" },
      { k: "quote", v: "Start where you are.", c: "connect" },
    ],
  },
  LH: {
    id: "LH", name: "Leila Haddad", handle: "leila.creates", verified: true,
    role: "Creative director · Studio LH", pillar: "Connect",
    bio: "Brand worlds for ambitious founders. Ex-agency, now independent. Studio LH takes two clients a quarter.",
    posts: 92, followers: "15.8K", following: 640,
    highlights: [{ icon: Award, label: "Work" }, { icon: Mic, label: "Talks" }],
    tiles: [
      { k: "quote", v: "Taste is a strategy.", c: "gold" },
      { k: "icon", icon: Award, l: "Studio showcase", c: "connect" },
      { k: "stat", v: "2", l: "clients per quarter", c: "community" },
      { k: "icon", icon: Mic, l: "Design panel", c: "gold" },
      { k: "quote", v: "Make it unmistakable.", c: "connect" },
      { k: "stat", v: "9yr", l: "in the craft", c: "gold" },
    ],
  },
  TW: {
    id: "TW", name: "Tom Whitfield", handle: "tom.partnerships", verified: false,
    role: "Corporate partnerships · Meridian Bank", pillar: "Capital",
    bio: "I bring corporate budgets to community programmes. If you run a cohort, we should talk.",
    posts: 21, followers: "3,412", following: 289,
    highlights: [{ icon: Handshake, label: "Deals" }],
    tiles: [
      { k: "stat", v: "£300K", l: "sponsored in 2026", c: "gold" },
      { k: "quote", v: "Impact needs receipts.", c: "connect" },
      { k: "icon", icon: Handshake, l: "Partner playbook", c: "community" },
      { k: "stat", v: "6", l: "programmes backed", c: "gold" },
      { k: "icon", icon: Banknote, l: "Sponsorship open call", c: "connect" },
      { k: "quote", v: "Show me the outcomes.", c: "community" },
    ],
  },
  RC: {
    id: "RC", name: "Rafael Costa", handle: "rafa.builds", verified: false,
    role: "Fractional CTO", pillar: "Connect",
    bio: "I build v1s for non-technical founders. Three FFG startups shipped so far. Portuguese, London-based.",
    posts: 47, followers: "6,118", following: 210,
    highlights: [{ icon: Zap, label: "Ships" }],
    tiles: [
      { k: "stat", v: "3", l: "FFG startups shipped", c: "gold" },
      { k: "quote", v: "Ship ugly. Learn fast.", c: "connect" },
      { k: "icon", icon: Zap, l: "v1 in six weeks", c: "gold" },
      { k: "stat", v: "6wk", l: "average build", c: "community" },
      { k: "icon", icon: Briefcase, l: "Open for Q4", c: "connect" },
      { k: "quote", v: "Tech debt is a choice.", c: "gold" },
    ],
  },
};

/* ---------- member photos (stub users) ---------- */
const PHOTOS = {
  KB: "data:image/jpeg;base64,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",
  AO: "data:image/jpeg;base64,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",
  MJ: "data:image/jpeg;base64,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",
  SF: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAWIB0iIiAdHx8kKDQsJCYxJx8fLT0tMTU3Ojo6Iys/RD84QzQ5Ojf/2wBDAQoKCg0MDRoPDxo3JR8lNzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzf/wAARCAB4AHgDASIAAhEBAxEB/8QAHAAAAQUBAQEAAAAAAAAAAAAAAAMEBQYHCAEC/8QANBAAAQMDAQUHAwQCAwEAAAAAAQIDBAAFEQYSITFBUQcTImFxgaEykbEUI0LBUmJDcoLR/8QAGQEAAwEBAQAAAAAAAAAAAAAAAAECBAMF/8QAHREAAwEAAgMBAAAAAAAAAAAAAAECEQMhBBIxQf/aAAwDAQACEQMRAD8A3CiiigAr4feajtLefcQ00gZUtaglKR1JPCoTV2rLbpS3/qbg4VOryGY6PrdV5dB1J3CufNX60u+q5BM57u4gOW4jRw2n1/yPmfbFAtNX1L2wWa3FbNmaXcnhu7wHYZB/7cVew96zi8dqOqrkpQROTCbPBERATj/0cq+apSiEgknAHOo9+WpR2WzhPXmaYfSamXebLWVTbhJfUeJdeUr8mm6VpVvBB86jo8QueN0kI455mhb5ZI7hOwnkriTSDCdh3KbDUFw5slhQ5tOqTj7GrTaO03VNtICp4mtg70S0Bef/AEMK+aoUaWJCgl7BVyUNyh/9p44kskBRyk/Svr5HoaYG76a7X7TcChm9Mqtzx3d7nbZJ9eKfce9aMw81IZQ9HcQ60sZStCgpKh1BHGuQxVj0jrK7aVkAwXe8ik5ciOHLa/T/ABPmPfNAadOUVB6S1TbdVW/9Tb3CHEYD0df1tK6Hy6HganKQwooooAKg9Y6mh6Vszk+X41nwMMA4U6vkB5cyeQqacWlttTjiglCQSpROAAOdczdoWqXNVagckpUr9CzluIg8kZ+r1Vx9MDlQJkPfrzOv9zduFzeLj7h3AfShPJKRyAqPr2m8xzumjg+JW4UxDSa/tq2Enwj5NNUnxcM17jPpUvZLQue8kZKW88RxNRVKVrOky6eI+WSox1BScHHOvZjCnbbH7pGS2VbWBWgW3R8VKBtBSs8SeNWBnTEMRS0hlO/mRvrM/JT+I1T4lL6zDGkBStjn0NTcXaUwpqSMgDG0ennUvrHSDsAmTFQQgcaiLXJ75vYdH7iBgn/IVoi1a1Gfk43Dxny2SlamlnengeopSkZOUK2hxbO7zTSySFAEcCM1ZyZIWC9TrBdGrhbXe7eb3EH6XE80qHMGulNJajh6os7dwhnZV9LzJOVNLHFJ/o8xXLuKs/Z5qlzS1+beWo/oHyG5SP8AXkv1Tx9MimJHStFfKFpWhK0KCkqGQQcgiikUZ/2039Vq0yLewvZkXJRbODvDQ3r++5Pua5/q89st0Nw1s+wlWWoLaWEj/bG0r5Vj2qjCmSz2ouc5tvEDgncKkXV7DaldBUOSSSrnSY0KRm+9eS3yPHFaJYIQYLewAB0qiWlIDveqzxwABnNX2JdVxW0rdtcrYHBaU5rLzbTxG3x/WVrL5CQShPhqXjAYAIqs2LUMOYpKGisKA3pcTg1Nuzm2E98vchNZpXq+zXT9l0Ob7CbmQVMuIBQRjFYHeoK7He1N4IbUraTnpWyu6vU+ruYtnlSDwDm4Jqg9pcOU801OlQVx1JVjaSQpJB/BrvGqtM1pVGfqKjKUnvQR9JGPY8PmvIispKP8fxTUud5HGeKRg17Edw+CT9QwfWtmmHCSooopkm/djd+N10x+hfWVSLcoNZPEtneg/ke1FZ32NXMwNZtRirDc5pTJH+wG0n8Ee9FIaKfqGWZ9/uUtRyXpTi/uo4+KYChzPeLzx2jn715TENLivDaUDio/FRyzyHpTm4uZeIH8RjNNWt6/UVLLRZ7BFUI6Xkp2ikZAqdiXu+Mht2NGQ413oSpotbatnrxpLSIQYzW2Nx8JB8q0CBZoZHeNpIB3kBRANYqpKu1p6Ecbcpp4REpLgR+qdhpjSW1pS4ls+E5GcpPMcvIg1alRCqzpfA2lFJUEmoTUC0MpRHbSEjl5mrXayBb44XvUE+KufTZ17SM8eueoxcm27SyAyVFJIbCik8irO4D+qc3pq73G2TolwYQ5sk7D7Y2UrA57PEVdJFpgrld6GkFWeA3fincplpEQICAnI4CqfzpfCV2936czuoUw+pChjkRTcktOgjkc1O66jph6jkIaGEjxEetV9SgQDnd+K2Q9lMw8k5TROoIUkHqK+qbwlbTCM9Kc10ODJHTUowdRWyUDjupbaj6bQB+CaKYx8iQ1s8dtOPuKKYkfd9iqg3u4RFjBYkuIx6KNMc7qu/bHazbtbyXQnDU1CZCT1ONlXyn5qjKOBk0ARk3e+rFN/pWPKllHad386RcOVGpRZc9NS07LiU5/bXg5/NaVZbmhTAClDIFY1peUliappw4S8Me44VfbaCpK0sqAWkZGTuNY+acZ6Hj8myLX+4PGe46mMt1KdkN9OO+rdar1OkQ2ER7UtaQsBzKgkoBHHfxqgs3O4pkBhyI2XM81g59M4q4268XohS1W1po4AWVqSkEDhzrnjO8y6Wom5KHrdJCirbYWcgj+J6V5LuQW3sg5JGAKYuPXOQttyW0y1GWMeBwqVnrwAxSV4mxLXAfmOkBDaSfWo/cQbnbMd1pIS/fLgTnbS9s5zkHA4D0xVeGRS0lxcqQ9Jc+p1ZWr1JzXrzOyEHkRXoyvVYeVde1aP7YrLOOhIp9TO3o2Y4PNRzTsVaOb+klpyKZ2oLZFAz30ptPttDPxRVm7HrYqfrWO8U5bhNrfUfPGyn5V8UUAi/8Abbp83PTaLmwjL9tUVqwN5aVuV9tx9jXP0jc2ftXYjraHmltOpC21pKVJUMgg8Qa5e7SdLO6VvT0QBRhu/uxHDzRn6fVPA+x50D/SjqBU7gcSa+Vp/NPI4Qhbil78A48qTeaw0CeJTk1JQ0BKVAgkEbwRVvsV3LiEF4kODcTyVVTWPCFCpCzHO0nzqOVJyXw01RpUKAzc9kqc2VDmONWu0adS0sOOTnHdnfsLxgVltuuEuE4AwvhwBq42y73WVvT3TeRxwTWKuj0JvViLbd5TMSP+4oEnclPMnyrHe0O7yJc1uGSUMoTtFoc1cs1oxjrUkypqy46BhKjyHkOVY/qR/wDUXt9ec4OAfSq8dJ3pz8h5GDUBIabQcZUoDH5NPQhEiPgqAKd+PLNRZVh5HQYxS0d0pcHmMVuZhQ/jKAGz9qXFNkJOCoVa+z7TLuqr81FKVCG1hyW4OSOnqrgPc8qaIpGtdi9hNt02q4vow/cVBYyN4aG5P33n3FFaA02hlpDTSQhCEhKUpGAAOAFFMD6qv630rD1dY3bfK/bdHijvgZLS+R8xyI5irBRQBxrqCzXDT92etdzZLL7R380qTyUk8wetNHXNpknmd3tXWGt9FWvWVvEeektyGwe4lNjxtH+x1B+DvrnDWWibxpOR3VwYKo5OGpbYJbc9+R8jv9aWD0q2P2/c1I2QAPcc9R0pkoAeHoN/rSe0ptzaaUUnqKVL2WFS/V6aCxb9pxpxsbjxq7WllKWgDsp3chWS27VMyI0lpbTbyBwJyD9xUuntBlJSA1CbB6qcJ/qsdcHIzZPkcaNA1FJDMFSEHeoYrFJygueog5yo1JXnU90uySmQ8EN4x3bQ2R78zUGsbOCD5iu3DwuPpw5uZX0j6kjZdIpRobeMc/g0m8rvcLHHnVj0Noy9arnBFtjlMZKgHpTgIabHrzPkN/pXdrTinjFbFZ5t8ls223MqXMcPA/SE81E8kjrXS2i9LxNJ2RuBGPeOnxyHyMF1fM+nIDkK80hpO36Vt4jwgXHlAd7JcHjcP9DoKn6EsCnoUUUUyQooooAKSlRmJkdceWy28w4MLbcSFJUPMGiigDKtVdiFrnKXI09KVbnSc9w4C4yT5fyT8+lZjeuy3V1pUoqtS5bQ/wCWGoOg+31fFFFAFVkQpMRZRKjPMrH8XWyg/IpIJ8qKKYhVmJIlLDcZh15Z4JaQVH4qzWfsv1feCnu7S5FaP/LMIaAHofF9hRRQxo0/SnYbbIKkSNRS1XB0b/07WUNe5+pXxWrw4keDGbjQ2G2GGxsoaaSEpSPICiikAtRRRQAUUUUAf//Z",
  LA: "data:image/jpeg;base64,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",
  NC: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAWIB0iIiAdHx8kKDQsJCYxJx8fLT0tMTU3Ojo6Iys/RD84QzQ5Ojf/2wBDAQoKCg0MDRoPDxo3JR8lNzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzf/wAARCAB4AHgDASIAAhEBAxEB/8QAHAAAAgIDAQEAAAAAAAAAAAAAAAUEBgIHCAED/8QAOBAAAQMDAgQDBwIFBAMAAAAAAQIDBAAFEQYxEiFBUQdhcRMiMkKBkaEUUjNiwdHwIyRDolPh8f/EABkBAAMBAQEAAAAAAAAAAAAAAAABBAMCBf/EAB4RAAMAAgMBAQEAAAAAAAAAAAABAgMREiExBEET/9oADAMBAAIRAxEAPwDd9FFFABUG8Xi32SGqZdZbUZhPzLPMnsBuT5CkGvddQdIxQjAkXJ1OWYwVjl+5Z6J/J6Vz1f79ctQz1TbtJU87skbJbHZI6D/DQBsrU3jQ+4Vs6bhBpG36mUMqPmEDkPqT6Vre76jvN6WVXW5SZIzkIWvCB6JHIfalK1BCSpRwBS9+WtwkIJSn8mmIYrdQg++tIPmaEuoV8KgfQ0uiNoWvK6+8ttQaU42OFKVBPu8s5FLYaJvEOhplab5dbO57S2XCTFPZtwhJ9U7H7VWYz7qVAAlQ/aetM2zxgFHLuk/0pgba014xzGVJZ1FFTJb2MiOAlY8ynY/TFbZsl7tt+hiXapbchrY8J5oPZQ3B9a5QSQRypjZbxcLHORMtclbDydynZQ7KGxHkaQHV1FU/QWu4eq2PYOBMa5tpy4xnksfuR3HluPzVwoGFFFFABVa17qyPpKzKkqCXJjuURWCfjV3P8o3P261Yn3W2GXHnlhDbaSpalbJAGSTXMGudSO6p1A/PUVCMn/Titn5Gxt9TufXyoAT3KfKuc56bPeU9JeVxOOK3J/oOw6VFr2vhMc9m0cbnkKYiHMe9ovhSfcT+TUfH/wAo9PpUyFHKlBShXLeuzqVt6PYkB90hSUlI707jWp15lTKs8KiCc1OtzIUkCrRY7eHHPeFR1mpvSL4+eUtsoMqwSYgLjJCsfKoVHTKTwcC0lKx8SSK3HMsSBEW6ocsVrm+2YOFa2xwlPMEVrOVp6oyvAmtwJEPJWeIHmPi8x3qQKSBa472SMFJ5juKcMKC0cjnHXy6VQSMlwpciBLalw3VMyGVBbbiDzSa6M8P9Ws6rs4dVwtzmMIlMjoeih/Kf7jpXNtOtHahe0xfmLg1xKaB4JDYP8Rs7j1G48xQI6gor5xn2pUdqRHWFsuoC0LGykkZBooGa+8bb8bbptFsYXh+4qKFYPMNJ5q+/IfU1oPGavHjHdDcdbSGQrLcFtMdI88cSvyrH0qkCmI8xS24ry6E9Ej80zO1JJCuN1xXc0gQMIK3EpG5p/DYJSEgbUltwy/y6Cm4ZjuqH6h5YUR8pwB6VlkZviRY7ZHUnANW2zf7dwKUoYNa+biTba2iRHkcTCtjnNWe0zFy0ZQCrhGTiorTl7PRx0qWn0bEWwZEQhtfFkbCqVdIRa9ok44sfDnnSKfJkKkEKubjCOLoojFTVNWtDDZVLU7KUMh5DhCv7V29VOzidzWig6iYLMskjHFzFYWt0lKUk+X9qa6xa9xhZ5ryRxAb1X4K/Zq59FCq8T3CZBmnVtDyg0UVoYm8vBK+mdYXrU+vLsBY9nnctKyR9jkfaiqD4R3I2/W0Vsqw3MQqOvzJGU/lI+9FAyq6hlmffrlLUcl6U4v7qOPxS+vVklaid8nNeUzkweVwtqV2FIztTeceGMvzGKUK2pDQwtCMvEntmmybatbvGGC4hSSnGM79fWlVpJbcSo5CVgjmORxV0s8lIRwkjHaps11HaLcGOb6Z5AhtxLMhDrJDrayStaubidgjhGwG+d/PpTnQyfZtzG8AgtEZPTal16dShpttJAU4rGSdvOp+jzFKXQ9MS2ADlQGcntUt3VLbK4xzFaRhqHTX6lPt4cYOpWgocClfCe46VhB0g4puMuVFW37HKlOqUONzkAASk7AAYFW63XViKkgqQ8yvGVtqCgn1phcJcVmCssqTxrHKu5t8PTisa/pvRq3WUcENBsEcGccPQ4qhM5KjWxb8tTsaY4kLV7BorPDtv1rXkcYBP+b1v82+PZN9eufQ9aVxtoV3ArOo8I5jI8uVSKpIydYpRhXq3y0nBZktr+yhRUNGeNON8jFFAHt3jqh3abFUMFmQ42R6KIqLVv8WrYbbrmeQnDcvhkoPfiGFf9gap9MCJclYZA7mlh+Gp9zV8CfrUD5aQz6xXFJdQkqPDxbdKsEOUthdVkHByKbxpIcQFfMNxWWSdo2xVplglusTeEvq5pHLnjFMtP2+1sJQoOFx4ugrZUvhQUdfWqwtDClIeKFKPzJBIqzWx/TIZaXJQ+h4H3kBxWCKmc6WkWw+T29FxiybTbYb8eKwy224cupRjmfOq5PmL41JZJ4M4Tmvo4xZppW43AKWQDwlalEnt1pRPmtw2Stw4QjbPWs2tvSNW+PZWtUyXv1XsPaKCeAcaQeRJPWliE8EZKz1P9f8A1WE2SqW848v4lqz6DpWTix+mSkdMf1r0InjKR5V1ypsZW45YI7KNS6XWpWULHY0wrozZNs8czLtBjJGS9IbQB6qAoqyeE9tNx1tCUU5biBUhflwjCf8AsRRQBe/HSwmZZI95YRl2CrhdwP8AiV1+isfc1orNdfTIzM2K9Fkthxl5BbcQdlJIwRXLms9Ov6Xvsi3PBSmweOO6R/EbPwn16HzBoAqVxVl4DsKij4a+ktXFIX64r5Z5UDPKlQ9lVGAJ2qZCSQD51zXh3C7GkGS2hQDwzVxs8+1scC3YzLwJweICqIWlb4pparcXlAqPu9ialyJe7LMVNdaLjdLrFd9yA0nnslHSqnqpgs2wFw8Ti1gk9vKrVb7c2ynjSkDFKNVRDLiqQjfIOayx0laNsstwzXo3rNR90Ch1pbKylxJBFYE16Hp5fgxtK8KWPIU0BpJbVYkY7jFXPR+n39T3yPbmOJKFHifcA/htjc+vQeZFMTNseCFjMOyyLw+jDs5XC1n/AMSev1Vn7Citiw4zMOKzFjIDbLKAhtA2SkDAFFAH2qq+Iej2NXWYsgpbnsZXFePRXVJ/lPX6HpVqooA4pucCXbZ78O4MLYlMrKXG1jmk/wCdetRcV1X4jeHkDWUX2yCmLdWk4ZkgclD9qx1T57jp2rmvUOn7np24Kg3eKuO8PhzzS4O6TsRQBBiKbOW3MDOyqaMRDskelJcd6lwp0iGoFpQUkfKsZFZ3DfhrjyJdUO4zXHlBTzFPrZwNYzjPpVcg6hS1MD8iGFJ+ZLa8Z+9TndT2/mWYL4V/MtNS3iyP8K4zY1+lu9qpaQEjc1lJhoDBW+pKEJHEpSjgD1NVJGtXGmQiPb2uMDHG6sqwe+Bik11vdwuyszZBWkbNpHCgfQUo+a2++h39cLzsy1DJjzZh/SpAZbGEqxgr86TlkdDivoVHO1MLDYrpqG4Ig2mKuQ+rcJ5JQP3KOyR5mrplStI8+qdPbIdqgSptyjxYDKn5DywhttA5qJrqjw+0gzpO0BtXC5PfwqU8Op6JT/KPzzNQvDjw7g6Njl91SJV2dTh2TjkgftRnYee5/FXemIKKKKACiiigApdfbHbNQQVQrxDaksHYLHNJ7pO4PmKKKANNaq8DpbKlv6YmJkN7iLKUErHkF7H64rWF507ebG4UXa2SopzgKcbPCfRQ5H70UUALQDXhoopiPRTOz2C8Xtz2dptsqWdiWmyUj1VsPqaKKANm6W8EJz6kP6nmJitbmNGIW4fIr2T9M1uWw2G16egiHZ4bcZndXCPeWe6ieZPmaKKQxlRRRQAUUUUAf//Z",
  DJ: "data:image/jpeg;base64,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",
  LH: "data:image/jpeg;base64,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",
  TW: "data:image/jpeg;base64,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",
  RC: "data:image/jpeg;base64,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",
};

/* ---------- candid portraits used on room stages ---------- */
const ROOM_PHOTOS = {
  KB: "data:image/jpeg;base64,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",
  AO: "data:image/jpeg;base64,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",
  MJ: "data:image/jpeg;base64,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",
  SF: "data:image/jpeg;base64,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",
  RC: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBUODAsLDBkSEw8VHhsgHx4bHR0hJTApISMtJB0dKjkqLTEzNjY2ICg7Pzo0PjA1NjP/2wBDAQkJCQwLDBgODhgzIh0iMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzP/wAARCACgAKADASIAAhEBAxEB/8QAHAAAAgMBAQEBAAAAAAAAAAAABQYDBAcCAQAI/8QAOxAAAgEDAwIFAQUGBQQDAAAAAQIDAAQRBRIhBjETIkFRYTIUFXGBkQcjQqGxwSQzUmLRFkNE4XKS8P/EABkBAAIDAQAAAAAAAAAAAAAAAAMEAAECBf/EACcRAAMAAgICAgEDBQAAAAAAAAABAgMREiEEMSJBQhMycRQjM1GR/9oADAMBAAIRAxEAPwCn9tdoPGnuHJxwN54qrptrqWr34FoJnXdktuOBQu7hmOpy2aEttbHHrWz9FW8dhpccckOx1UZOO9c3alpN+wqTPLa81SwsvAFqd+0kMW8uaTl1u6h1Zprtm3o/IBOK1ENFrE5jhyET6mxSp1P0fBaSi9V3ZHOCP9J96OsTcpp7ButMF6t1E93a58KeOP3bjNBNF1B0vg7zOozwCxxVgytcWhjdt4HAFGNH6dZ7DxSow3OCKqVV10U9JdjCvUNvNaeGD5gOTntVLRrgiZ5p5QsZbglsA/rWZTdSXDag6abHbrGASJbh9oIBIBx8+g7mhuq9Sz3d3DA10sCxBj4iIcE+uBn1x8UV4ry6ddFrUmydU6laJYgrcjLcL4ZLFvwx3rjQtVt/ukRrOpGOXBOOfc1gc+tMZDIk77t2E4wAPw9Oauab1jeafcR7ZRKY843kkZPfitrDKe9k3s322LwM7M5we2TVYXbvO6qxIz3zWZaf1LrF9JEkF40CZyVZFKooHfB5x8c006brSzRxieVN7AneowDjufjvSmXA12vRtP6GBJJBcHLHP/yovFJPHASrsfY0vuCGBJz8ijdrcFLQZIJ9zSjXezaZBqWgT3loZ5biXdt3Y3EUqxRX5hkjtfEIXg92/nWiC5a9syjIVyMZFWtAtIrbSI4lA4Lbs9yc+tPx4+OkmvQGqe9CXp/S6XEcUzylpEYGQMT3p/MFslqUZV8Lbg59qE6lObXVBHHBlJEDMU9D2pQ1++1GOR2jkcQS9lz2xR7uMM7MSm2LmtX0OlaxPbRBjGreUhj29qH32py3a5id0UDkbjzX2t2n2m08dHLPkbsmgbtLFCsagj3rm003sJ2kNOmaLHFdJdSYZ3cFjnvWtaWYJocKuMcVlN1qkDWqNE6q3GCpol091RJC3gnfKSeMUKW1XKg216Rpu620wluFVu9ANZ1SPWwdOs27nzv7ClzXNfvpsQpCVDdsnOTVDpm5urW9medMZ9TR58ppaX7TNRsv3egrYrlCd7Y7+tD9X/aTY2GmSw28GblN0aoeBnGMk/n6frXPW+vyxWkARirSy7PK2PKASefT0/WsXubvYuwBdxJbcPUn0pzxX7temDpL0ye41GJ1EXgRh2X/ADRncMDAoLJeFpkUsdoUggmq88rmYNzkcYzUf2eV8bI3J78CmXRnR488hA5OFBFcxXBRyxzx2q/aaJe3beWJlA7kir//AEnOwJ3fyobySvbCTit9pHOn666SKjg7V5BRippgteo1sCGtQAT5WJfJH4Z/tS0emrsSbVGTVWbTru0YF0IyeM+tRNP0Rql7RuHTWuJqDfZ42Z02bgGAG3uD29OKa7abHkLdvQ1i/SWoS6ZG0/jRqcbcnng+4rRtB1mHVFLKds8ePEjz6H1HxSfkYePyXoks0+zZFtQ2BnHNKnUWuX2lTrLp0m3cfOpGQaL6YWmgC/UzdlB7UE6o0e8jt2lC5x5sfFVzy8FxRWp32G9F1FLqPx52VpmHmJNLXWOqwBnFvhiBjvQoX6w2uxhiQj0pcu7gMW3N60veass8aL4qfRHA0pDl2bYecGq26QSMWTcvp8VIbkLA2MnPaq0OobQyMACfepx0tmSytk0gUAkk+lGNOZbCeOQuBt75qjYXSpcuVXdg8VHql4Lp/KNretW030zW9djvYXlvqV+GbBVB6VcktxNdsLUDaO9Z/pt7PYgqOC/rT1ol8LeH/EMAXHelLji+gs1sznrq8b7yktmXaIYkKn0JJOazuVg0nJGSf1pw65u1udfuhBIrRRYjTC4z6/1NA+mdIGuaptkYoE7nHeu5Ooxr+Acp1Wjrp7p59SmDyrnJ4XFaDb9IRxAFygGOwozYaRBYoI7dB+J7miX3bIxBaXHwKSrJV12dGMcxOkCU0m3t7faqj54qnJHHGhVYxn0pmFiw8ruMe9C9RvtM0qNjcSIuPUjNTTNbQsrZyGUuV4z7VQ6nsbeWzdx5cAdverkn7Q9JilKC3M6fI21zc65oWs2TRxF7a6Y8Qy8q4+G9/g0zEVK2K3cU9GdG5EKhQdwB7nvimv8AZ/qjRdT20BI8O6VogCfpPcfzGKTtXs5bC8aNs7G5WiXReJeq9JiYhN15HhsduaPSWSRJ7l6Z+oenZo7aQrPhGPbPtV7qLVLODTpA8iMxUgKDkniuoOmbbwB9oLPNj689qW9e0aOKKYs2Jo13Z9xQr5Y8epRS7fYgaveRlI1VNrAcn3qrZaX94SKC2N1W2sDe3YDDj1xR99M+7bMSRjygVyHX+g2gPd6NHa5XPCjPPrQC8sEeYvGKs6tq9xLLtaTIHBx60OS/JbFG70Y+x30/ptPsf2jdtdh6UvT6JcGaaQxtt3cGjej9TgwiGQZwOOKL/edtJaNIxHY5FLO8kMNqWhGFrLAVaU9j29qLw32biIbztHtVG6uhdTY7AmjOkabbNG5kySBwfaiO9L5GNd9GYdapKepb2aU7TNgpjsVIAz/Wr3QzqdUuJmwkNtFudvQVN19aYlhuY/MAfCb4HJH967/Z1ZpctrSSj93IiHHuOf7iukq3gTNYv8iDF31HrN1M40ayZoOySMuM/PNCF1rqlbsreXqxqD9BYf2o1qMl/LcCz0uFxEgw8ijKr8nkZ/D8zSq+mXv21zfzB5GA2xpgnPuQB+NVNbX0hipaf2zRtIuLzUdOYySjco+rPekTqaXxNQeCbc+T9Ip26X057W2fduXcowp96D9T6Mq6gJ9uN6A9uDxzQo9thsi+KQnxzWGk2/iGyyzDKSbM55xgEkZ59s19FqUF7NskiVG7jK4xTImi3lxCqw+C0foGjBA/Ci+ldGSu3iXMi7R/CseB+nrRtp+vYHhS/gUeo9LS/wBAW8j/AM2Ejdj27UqaG8tprdrMiSPLBKsqrGuTlTn+1bPcWdsIZbJowI3UqeMcYxWdadpfifbMSqtzGzKQG5YqfQfOM0SMnGWAyYuVpH6lstat7qJCTtkZA232yM0sdVXJ2TMSCrLt4rzo+WHUYIbp2zI8KE5+R/zV7qXSPFi8SAcgElB2NVyrJi3oXa41pijoFoLgKWGB7+pq1ryyJbNHGxYD0onodkGtjMSEJH0+1CtZd4TLzlT2Nc7LFKU9ewiaM4voS0pwvOeajtrHfIDjtRU7XDyEgnPavWmjhTJGCRVRNPoy2keQaYbaHxnbgjgiohdyhmVW8p96ctY0NoLQ7IzsBoPLomy1D9jjJoSyJ9sNUOegPBAWfJ5Ga0TpuGKayIdOwxnHekm3hBBAz5eKbNO1mDT4kGfJwGHtVVumiT0LHVWiW809xaSK5R/Ouw4OR6UL6H02bT9QvIJ+Vks0kjPupc1q2m2Vj1DezXDKGVBtyOcUk3MDaN1RZWs5AaGI2jj/AFKxyrf/AGA/WncSuMaT9MJiU1t/aCj9PxTwKxBG7nHpVRNKstKLSbIlY+pHJoldaqI48g4AGB8UlHWEvdVe4uJttvESFBP1Gr6fSG112x0to1hVnuB4efoz/Wl/XNd01ClteOfB37kfIBX3FKWta7c3Gqi40+GabZwo3M2cewFA9TtNav8AZO9q9vkYYSEKR8DNEiGumDvInvS2O9rrkdreMLX/ABFoMEMQNw+OO9H219DAJLdxzzwayezmvdNgMeY2bvjcM19a65P9qA2HDMA6j0zxmreN/izKzL8kaBda0LqQNIfMDzj1pW0+3DO17AuJEldrhicDbv4P5fFD5rx0vGVX7Yz+tMfSEqy6hNYwQGa4z4mw42bGwCTnsKvWpbZjmuZrnROnqiRzbPJ4KbR6DjNNupYSwmlwMxqWH5UN0NUtVKDhDgKPYCrHUCxzaPcRvIURkOWBxjijeO1+n0I5PbYr6Jp2oahpBuom8NZQWjDdyDSZ1E13p82yZ2IIwQfQ0/6H1bpkOiQJcuITDGFPHBwKyvq3XTrmsSSQowiydoPes3MOTD2gB48niuQTtzU37ydFJLFRVQ7ogQw7mj+nR7rYSvGdg+OKE3ons2+/sVu7UxIB5higN9oi2+nMvmLAUwaNO01oryDDY5HtVy7RJIyMZzQX483HL7HeWnxZkVnaMryhlPc4oPqztbMQeMnGK0DWo2tScQ7V9CBWcdROJAMjDg8isxPyBWtdDL0Jr02lo6KniRO2WHtRDqyW01S1vruEr9p2BgCfpZRkEfjik/QL8WsRGM8d6knlN1dFo+T60SslJ6fokUpe0DTqUsswglbHjL5X9jSpDBfx3j4tHuGhPMStjdj1o7qyNFIsDrsZcFH9x6H+1XNKuY4ruKWb6im1j7/NbT0tr7GU+etsLdO2ltfact5qWoPZyHObWCEkpwcZ4+P50Vu9E6VxNIv267JQeHkkBT688V5JPttDNbw75AMjB2mknUte1ea4aLwCpzjgbqmNqvQe9Su2yXqDT9Nvg1va2MVuQzeZW3EA4/LihaafaaVFG6qFKnnnknHFELW0u5VE0rHd6DGAKAa3P5wjsRtaiLddIBbU9lATqryu/Jc8Vpf7Jre2u7rVJy4N2vhx4z9KYz/M/wBKycI11dRwxd3PJ9h71s/RmmR9NxXV/EwK37KyIP4VAxgn3zms+S9Y2vti299/Q36rqlzpDDA3R1Uv9RudQ0olg6Kw7E1S1vUCyCWUqU9qGSdTpJYG3jUDjGaRhXroy6Wy9oPT6aggefzZPb2rjWdEtLS8JAVSKFaL1RPYOYVww9M+lVtaur2/eSZyQMenGa3U1z7ZTa0Crx7eW/A48MNz807yXNnHobeaMR+H6fhWYGC4uZiIlYqO5FGreLNkY5GPA5BNFuVpdmZZtvT94Z7ISEYDDIoxDMpfzHNIfReqm+sI0jO7AAPxT3DbFVz6+tExN+l9DN69kl1awXKYcAisl6+0lEuIpYwAeVOKf9evL21gzAucHnHtSNrN0dQhUyOC4Pb2rOS/mtIyp77F/R9Dvb5NkKhUPdjRO10SfTtXjgkXcr/xUY0W/i061xJgJjv7VHc9R2k2powYFV4zSOasjppei2plljqDomHVdKIDmKZRmOUDO0/I9RWRajHdaHcLBeoVdGwGByr49j/+NbzN1PpcFjItzdJGY03OvdlHyB2pA1eO31q3eZIMxTeYJJgkf+6P4/6mKd0nxCY5WRuZfYvW/VDCNFjChSv1GqmodSRKke0Bmzznv+NCL3pu6jd1tJSp77H7flQK70nVFbEo7exp6f032mSqyrpoL6nr7bsxSMM+x70uXN5NfS5LFvcmu/uydiDKx49BVq3sNrgYwBROUyugDmqfZb0i28HDfxHkk1o1pq8lpYWBuUj+73fwWmVvPA5PBZfVDnGRyDSba2/hoKuX0zHQZogezA0CWrr5LYa8f9vQ4arZT3SvFbTRzsF3gK+CV9xnvSzJHNaQnxEZQexPY/ge1ArXUrmK9jeC5eKRTlWB7UZt+oRcoZgklpdDieS3CtHKfUtEeP0pv+mj8Tnbf2daVMFug0h4pp1LUbQadhdpYrigFtq+myyrHd6dDMrf+VpxMTL8tG3FNzdPaVe6OGsLuObxB5GY4yfbI7GlM/iW6VJbCTaKfTK2YsyTs3Hvml7qOeOK7k+z/T8U8aP0fHBp5aQgvjnDZ/pSHrGnyR3s6ICUVjzSsTrI9m6/ah3/AGYJJFZhzkKzZzjvWurIqoMkUI6ftrFdGt1tUTwfDAGPwqx9jZ0wZDj05pzGnK2vsLWn0/oDdQ61axAxM4DUgNKl1OzR9i1M+u9Ogr5plXJJLSNgAUpyapp+gkR2ZhvLpvKjudwVvfA4A+M5qRhvJ8mU8il6L1/bWO6OzlvUgmdd23uQv+oj0H40pdSahp+g2qwad40t5McC7fGEH+1ff5PagV3rVze318LiQRyTY8SRRhm9vy+KFao7DTLJpSTtmfn3HFNzhiPXbAOnb2y3eX0i6ZFaZZYw6s+GyXY87nPqe1O/S90LjSVhJy8Y3fkf/YNZpLIXt1YH/MlI5/DimnpO88K8iUtgOpjx89x/Q0Hyp54mM+LXDKhzltkJJ2gmht1p8FwGUgK2OKMGRWGar3EayRnGM/jXHmmjr1KYg30KJOYVXlBzVeCDMnbtRq7shG8jk8k9zVOBRvYj9aaV9Crjs6ZAiUOv7nw7KQZ+ph/Lmr00m5sA0tandC4uxChyiHk/NG8eW7A+RSmD6E5uUY5xmpDI0F0ZASMnzD3qGMESDv71NPG0jEjkV0jmE8jj/t48NucEZohpOoXdjDcNa3MkRwPJnyn8u1C4lAVFPGO4q5bkA88Aj0NaRTHLRetLy3dTcxCR/wCPY23P9s0xpe6N1Cp2P9jmf/Wu3d+XY/kazJHjjbJYkD4q/b6m1vuKAhMedW7NV1EWtUtme16HDpHqG8+87SxMuInbGM079T9YS6S0VlYNF4xGZJH7JQXVdP0bpTSrV0hSXUFUOJG7r81nOtapJc3AnLE7znk9xSfj4vzf/BvLk/Et9Q6vqeoX3h31w0gA3bQ+EIPbA7UvrOsd5GUjZAhHHpXN1JujQDzCMbQQf4TyP0ORVUzYAAD5FOtpiy2jzUTEb+bYxyPWoNVmEuhxYbPhyEZ/Sob2QNqB2gAMnOD3qO4YHQnX1EgPNDpm0eyNjSYW9RJnn8KI20hjztYru5Vl7g/H9aHMobRwCAMOMVYRiEOewAPHxWWi0xy07qPxVEV3hLheGI+lv9w/Gic90PDyG7jikFJxuDuM4H8qIQamnhmP7Quw9g5wRXMy+Lp7k6eHytrVF27nV2O5ycemaiDrHbtISAKEXF7ErZa4THqFOT/KqV3rck0H2e2j2p6u3c/8Vc4KZV55R9fao2GjiJDN+uKp20WDk4LHk5rmCLLFnPNEEhC4yMHFP44Uro5+S3b2ziBP3gJ4zUk2VbCkgV2Cqkc5b0qs8+6YKe9FQNluMExlyOMe9TIcY9M/FVhuZVQZwBnFdbuOMccDFRMjRYaQAnGSB61FJIxZYlPHds1yDjO4HAGfiq6kKrTSHC9/xq9laNG6u1JtQ1O5lLEpuwgz2HYUkyy5jeM5JVuPwNGtYZ2lkPmOH58p5HvQO4gfcXVGyRgjaeRWF0EZyr+JauvdkyO+Dg1RRy4DbsEe4qzCrLMGaF9jjaQVPeq3hPHLIPBcgHjymtbMsjuz/iImxjII49aikJbTZ1PYAH+dSmCaRID4b5D8+U121tIlreIIpDhe+01RD60kH3c6jkgBhn4NWInVnypxnvmq9jbTPCAYpACuPoNdJHKqcxSeU99pqFkifu2ZGGQG4NQXARvqJX8R/wAVN4Mud5jfn02muzFK8eDE/HrtNZaIgWyRKfq3fAFe/Qm8rtz9IPc1daB0JKwnI/2GuUtZGkDPE7N7FTU0Q+tYtqgsck+Yk10JiZ35PsOamMcixswjfJ9QpqpapKC7NG5477TVkJYt0khz2HtUEQBuZD35wKtW8MxDMI3PHohqCzhlLMTFJu3H+E1ZRYkfw4eCcnjFdA4KMcYHPvUV6sixIBE/B/0nmvpDLuwsL4CcAKfWqLOpWAt2J7scVUmb7RKIAf3cf1H3PtU1540SxKIpCcZ27T39KjFtNFGsaxu0rck7T+Zqyj//2Q==",
};

/* ---------- event photos for feed posts ---------- */
const EVENT_PICS = {
  p0: "data:image/jpeg;base64,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",
  p1: "data:image/jpeg;base64,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",
  p2: "data:image/jpeg;base64,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",
  p3: "data:image/jpeg;base64,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",
  p4: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAwICQsJCAwLCgsODQwOEh4UEhEREiUbHBYeLCcuLisnKyoxN0Y7MTRCNCorPVM+QkhKTk9OLztWXFVMW0ZNTkv/2wBDAQ0ODhIQEiQUFCRLMisyS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0v/wAARCACUAjADASIAAhEBAxEB/8QAGwAAAgMBAQEAAAAAAAAAAAAAAwUAAgQBBgf/xABBEAACAQMDAgUBBQcCBAQHAAABAgMABBEFEiExQRMiUWFxMgYUgZHRFSMzQlKhsWLBJGNzkyVTkuEmNENygvDx/8QAGQEAAwEBAQAAAAAAAAAAAAAAAQIDAAQF/8QAJBEAAgICAgEFAQEBAAAAAAAAAAECEQMhEjFBBBMiMlFhQiP/2gAMAwEAAhEDEQA/APLNcy5/iyf+s1W5JnkV5LmQbV5/eED/ADQyASPNjFLdWBUx4Jwc158E3Kk6Oub0OLaZZg0KXEuFxnLnn4odws2noXE88ozgKZDjP50rsL77qY/Cj3Tbsljzx6Vy8vJrm7kZuNzfT6U6xz5d6I8lQf8AaLtIrmaWMjniQkUyj1mPxQniyFXGCxY8H1rzuxs+bjFTeqkY5NVeJMym0N9Uurm1uQ0dzLtYcYdsEUBNSvFmUPNMAR/WeaBPeNeJEkoQeEu1TjBI96Lc3a3RiLrGGjTblSRmtTSpjXu0Eu76cSjw55Sp/wBZrkV3cs5LXE3T/wAw/rWbxEXqpI9Qc1YzocbGHxQp1Rr8mw3FxM2wTTAD/WauJpYww+8TFu4Ln9awmaYnKAYxXHmLLgnLZzxS1INoO9zcY/jykHsJDx/egm5uVB/4ifH/AFD+tRmJU8YriJJNGVXBHrTJ0L2aINQumdQ0srA/6zWyS7KjAunUn1kNKmkK+SI+UcFh/NQiQhLEZbtx0oOFsdSpDh7qUggXLB+37w80KS5ukiyJpS2OcOT/AL0r3EkFsgHtRJpWLiNW6enFFQZnJBDeXDjmeXI/5h/WmmkXM5glJnlJHHLmlKKSpBBY48rUx0XJimz60MnRsf2Fr3c+8/8AES5B6eIf1q7XlysaqZ5SDzjxDWeYqkjAcnJrVZWRuSzFuFGRVG9WyKVuka452SMMJZV9SZDmrtIyZY3MjADOBIeP70puGZ2wTwDVJMpgB85HOKHBvyaxhPeM7ELNKD2w5/WgtPOOlxKB/wBQ/rWAk5zRkLMpx2puNAuzStzcINwmlwf+Yf1rgvJ5Mq8suR0xIf1oUJLHDj4q6oxuduOopWYhubnotzMR/wBQ/rQ/HuSebiX/ALh/Wjuq7iARwKkcPGe2K3OjUB8e7x5bib/uH9aJvuSmWuJiR/zD+tHihGCMZIoVwyxx9cc9PWtzb6DRRby5UYFxL7+c1xrmdjxcTZ/6h/WgNON2VXFcSYBwSvSnpgNwu7hI9pmlBbv4h/WuxTzEENPKWHQbz+tZdwlbP9qIn7q4DE5GOQKmzGmTUJZPIZpAQMfWRV4LuVWKtLLyOu81inQPIWUYyenpRIJhKpRgA3ala1oI10+aZp5GE0hAX+s0vlvZ1d1E0ucn+c1p0YsZJA3UDFYbjCSSMw/mIoRu2h5fRFDcTluJ5f8AuH9aILi5P/1pf/WaFAu9gQMVpZdkRb34zVGxErKx3lwjjE8oH/3mrTXUnVJ5ffzn9a7Z27XEpDtgH2qmo2sliyrwyOMqa12x3FpWD+93BP8A8xN/3D+tMdNlupCm55nTPTeaVRsrDzLgj0716XRLyKCzwVyVJO1h/ikytpBgk3sbeLcafpcwhd2jIJyzHK13T9XvtXs0E8zBYBtBzjPvS671NmuIgZFNuRuO7j8DQbnVlhBSLBLLx4eMZrkqTX9Ktxs7ql6wVrazE7FeN5c5NL7ZrgRYkmlB9C5rs15tg3oD5hk885pak8juC0hIJ71aClQikrPZaUz7WzI5GP6jWnRZUN/eeJI+AeMsaW2EhSJsGhWDk3Nwc9Wp0m4jSaUj3MurafDpT2xzIGYfzcikP/h8OpXs7XEiiNFMY3nGT1pL4PgCaTJYk5waV6UzXGpZckh2zg1SGKTkqZLJkjGLtHptQ+0EO+Lw5pPL1wTSuHX0tvGkMkrFmOBuNa9ahT7zCojUeXsK8tqMZSLIGMscYrtm5JnDjUZKgz/aO6ZhiSQLknaHI/vQZtev5jhrmQY6ec0swcZwRVGbgjg1Hk2dPFLwbG1S+d95upyR0PiGujUr36vvM3/cNYeQo7e1XbGFUE570AjSHXdQUAG7lxnPLGmKate3YURTS7vZjXmwC+3HGKJFMbeUMOeetFdisbSXmpCdllkmEgPTca126a3PbvNFLMIk+r94RXLC7W5uGmlKtgZJp3oWoJe2F7bhdjckAdxV4JN9nNklJLro8vczXoRjLcS8f8w/rWGa6uA67Z5en/mH9a36knhl0bPlwKwSx/vUH+mpNfIrCXwsYJJPsXxLu46dPENdRpGnVBPOc9vFP608FnG0CZQHCisP3H/xACMcIFJ/GnlBoSGRMzOjo5VpZRg45kP60eQKinbJct048UiqXkZ8cA9z/vW1YAW/Gsls0paQtVcyDI8uc/NZdZj3LGfc1p3MqNGB5getVu2RoV8TjB4Nebi+6PRyP4MUQxkefpt5zRYlUz72OR3rRFGhUAnKmgXiiGVo1+a7JaZyx2Cnk3E+nYVmPWrseaqayGZXJqZqEc1MUQEDEdDRrb95MqucA96CBV4eJkPuKD6CuxhdrLDhNnlb6WXvVIYymC6kH3FO7eLJHQ9wDXJ/BnTKvtkHGD61yudaOr2r3YllcMWx2FcMvhWwjUeZ8kmtUjKjCIhZCT2FYbos0pUjGOOaeOybXEojkEnOMDjFcUFiMdaoR1x0osSsAD+VVJjG005rgiRz+VMP2PCxO5WGepB61fS1fZl0KjHfvTeB1AAABNRcnZ2Qgq2hBNp40+Npo3Lp02kdM0HRW8kufWvRXluZYZI2T+IpA/KkVnayWRKP/NzSyetiuFSTXQmnT9659WNNtIRVLI74Ur1Hak825rhxgjk1qhk8mxc7yMcdTVpLRyx0zNcrtmZQ2QDwaoFz7mn8Oi28tqskkhEmMsKDZ2otruUIAy7RgtSrIq0UeCSavyJmQqMlSAfUVoskBDE9+MU51OJJLfzlVAPGO9JJJTE2IzhR2FHlyVAlj4M0PAY15HJPFVEciy8N75oSXzMwEuWGep6itssq+LlcYC0u12LS8AWQGLcSOW5Joz3NuI8CQZA9KubWOTTZLhgSwOFAPT3pIw2n1rRSkFpxSf6OImEVuGDhmbkj2pXdSmWZj26CuQOVkAHQ9RWiG1DjcfXpTpKLtir5aQKGymlQOq+U9zRV05v6x+VMoMRwqncdPitVtGrcmMmkeR2dEcMa2JRYSJ5kYMQM4x1rmCD4h4AHavRyRAAMkZyvOcUku7YxM7D+CxO00132SyQUegUMgYM3WqR/xA47VaFAw44xRl2Q+IhIrVTomk2rN2lsDcsR1rBcqPFYyHjceBWjRJFEzhMmsb20j3h4PmYkZ9KWKpseW4o2WoUB2VOnT2rPcsz7UA+k9u9FS6WGR0bynGM+lYp7xhNmFsAe3Wsk2xU6G9vEqgEMVIHNV1YeJbQyCTco421mt7pru2kXpKgzgdxQWfxVRTkbe9FJrsrOcWqRQPGkW3YzXDHyjsBQJxMmDLu9h6U80W0jeBrll3SSMQCeyjitd5YxzRbf5j3pfdSlQ6wNws8iSTXVdkbKsVI7ij3Vu1tKUZaAy96uto5mqZrFzLNEI+OPQda5DwwyO9BgypyK74pilwVzg5pXGloye9nrtObdAxxjmuacMzy+7UPRpxPaswGBnpRdKI8WQnpvNCEdJMact2bp4sxyeymkv2cQG9g9807muYTDOElRmCHgGk/2X81/B8GuvGto48z0z0OsDbfIQAcIeDSRAktj5owWZjj4zTnXpFiuy0h2qI+teft542iVYn3AcE0nqp8Y68j+ix852+kLtY2RQhFHnJ7Ul2nqa9DqFiXzITkf4pTNblfxrlxSVUd2aL5WZMetTgZossRQgUEjFWRzsujbRuB5rijfuJJPFcXOKuP4ZA/GiANYOVcpuC7hjJr0/wBmLWeLUZB2EZz715NDtYADJB/OvoH2PhLNLKQeECjNHGv+iFytezKxX9oLMxWckrr5nkHOKRuo+9KPRR/mvXfbRyLBFHeYV5VI996uemFH96vNLmc2K/bPXoMxgewrHEANUlJPAC0xKDaMUqiO/V5wO3b8KafgnjppmW5XddryOvSmMSZpe6j9pRg/NN4EAkUAHlhSxW2NN6QitZ0iMrswdwcBTyWH+1Z7yEG1Z7lTGM+U+/pWa0lWa6kmRdgABYdga03WoSXdjNIdhGRkEf3rzFCmes52hIskgIAJAqSyGRyxOSe9brq6lksQTFGisdu4Dk0szXQnZCkujvqewqYrg5wK6OhPrTCnGHIqYwRVurfFRuoPvRMVA5NHgjzsbuWxQiMnI71tsI98saj+U7jQbGirY7dJXAMRCBerml1wQ8iRyuFfd5io9aYSK0qAEsB7HFDh0q3kvrczv4UYPnz39K5m15Opp+AFpYIS7OWLI/lb1FLdTiMN3IuSVzkfB6V7TU7BIIfGgIMankZ6V5DVyJZt6Z8uA3pmtjk3LZsqio6GGnxwnSt+3IVRx7981S4sfCkRogFRuQD19qmhSPDCfETfEW+k0e/lWR0WMFVX6R6Ci38h6TgmMEyUVehNVnt3AKhd/oWcj8gKFZTdA31Ad6ZCaEQjxGAbtk4pFplNNGJWe2t5UQuz4yNznp369Kx3Esf7pYmJaNcNk55rVHeRGUBmUMWwQBkUoSNVu7vY+5Vc7T7UWv0SWuiisktm+ID948TPi57elZbQmO6DOCMc5plaXrR28mEVh2yO9LpC0jeY96dNu0crSVM9MJlltVkCA8ZPbilOp3Ty3MSRDYGGR2zTexAn0aHaibkfYSe9KvtIgOpCNVCiNAMCkxqnR0ZcjcUwbK82nru+rxMCk8vlcg9jg0zS5MNoEPOyTIoVxpk07LJbIZFcZOO1Ui6eyMlyjaMAIzWxozsznDY6VRtNuIl8SaNkRT5jW7TZBMJEIyV5GR2ppulaJwjemNNOig/ZR2FjkYOfWlmpWSpajwk+nnd3Nce/MDCAjauecda26hcw2unRbGDzSDKj0HqahFSUr/TqcouFfggsoyZgzghV5psyKGBB9N3pSiO5dZt7+YHqKZlo5LNpUIzjB9arkTuyGJpWi75JIAbnsOpq/htCyyou1VHaQnn0xVLG5VnXeMmj3V9CWwh8oPIXkn8antaOhcWrsNeytdRqvUbc4bpmsV6VTS1hYKshkzhRgGjPqFsIF2Rzb+eSOgpZql01x4J4GFzx708EyeVqnsNZXcdvayRMu5pR19KBJZvt3qd2ecD0rTY2UN3aByxWTOM9qyC7ktXkjQ+q59qbk29EUlFb8jCxVYJ1VcZOM0FV8Z3MbskiZzk5z8US1g2ssnI3DPNchvJLK4OY1bnnI5NJfdBrSTFVyXMxD9R1oVFvJzcXMkpGNxzj0oNXXRJ/wujsh3KSDVxKzONx49KDmupjcAeM96NAPV6W3iWDLDJt2DCtsx+GKlqzSMd7XQYNjewBU/hWu3iiitxGhXgfTz2rRbrGVJfCt6VwN7PVUNKzBqlpHcWzlly6jIYDmvKAMW2nHGc17q5GY2WLHI5NIp9Pj8IsdoZTuc57c10QnxRzZMfJ6EoOxfijQW/3uZVz04J9u1Z5XBbyHKZ4rRpm8yOikgsuBVm9aOWNctnotLMccTQoQdvBIFCtnCRyBgWVmPSlkFxPZXLQJhiwz5h1osNy8EvhTDzOcjFJJ/Gikdzt9GgWkMUxbYwU+9avs0Y01MFjtVcgUKW5W3tvEuRlT9K9yaw6bcwozTyNhR/LnmqenlW2T9XDkqieh+2EkckyIctkDgf2pbZ2/ggLJEBtGAyn/NHi1D9rOZxFhYvIvqfmtBj8gbHBrn9Tkubo6vSYuOJN9mS6Y/d3CjJIxS60tHumYSeVBxmt17KVXYnXPOKtYMxt5AMF8nGfWpJtRLSSlKmCFlDJDLEUXh9qkDkV5ll2Myt1BxXp33WVsYd/iTMeDSjUoAmxgpLbcHirYnXZL1EU0mhZkdqsCO9cGMnjmriM9Vww710HEFt13yopPBPJr6X9mpIxpoK4Hc188ggCWokLhXkPlXvivXaZPZLpzRG6COy4POKthat2c3qYypUgP2jnNxdxwB1aL6hj1pHqNnKw3q+0KOFFEgZxetuw8cWeR3FaXjiky5JXaOBntXHmm3ks9H02JLEkzJpmsXcNtJEH3BeQW5IrZpUlxNfNJlcP1J6mlNlsF4VVSd2d3pimFoV+9IqA8Hnmn5y5LYiww4vRsQ79VAI+kc05hI8ePJx5hSWGR/2m23gEc00VT15ye9dsTy8h56PRGRZM3Q/edQFNFi0mOO1eFpWYMc8Lilx1m6P86j4SqnVLl+PGb8q85xl+nqpr8JrUcMO2O38QLnoxzzSkdCa0XczSN5mLEetZz2WqQVInJ2zvRfc1C30gV0jkCqN9XxTihAduK5u8nuTUbpmqLzxWMbLVfE9MjpTCztzGpfPmJpdassUgyDkHmncDAD8ajN0dGKNm23kACiQZrp2PM2XijULndIOMChhlLpxu45GcZrLr1xD91jSO0MR3cvvznjpUorky8nxQa8+08caeBb24nRl2sXOAfivPT3BZjtG0ZzgHPNBbzVztmuiMEjic2z08TCSFGXGGXIxWC7cxTAv09avo0heAL/ScVpv7dpADgGoJUzsb5QTRnjvYzGQCd3bjpTCJYryRpioZlwMMSBgD+1eeljltidoIB9qPpt80LYDbT796fjq0TU91IbXb20Nxa/ulTzHOGDZNNdNtfvytHb2oknlc+fHX2rzE8cF5MsQmEbEkrkdT6V6r7KWklrpepsJ2EsSB4ZA+PBcnG73qc0uxuTbYbV9LuJNLeO3tkAtIMysi9SDzn3FJdB0Ka9Kl7fdvUuAx2nb6ivRfaltQufsxZqr4YQkO6vtMy98+ufSuaNp8F/oFnLqF3cx/dI3jdVUhh6D3GKRSqOgVb2I9MDLZyRojEJcZBx1ANb9S0nKSTTW3nlVmRuh6e9fRdOtrH9lQiPYUMI5xz0rzmvRahfaIkZji3x3Bi38b1ixz+NFtppmTTVHz7SdJe+t5vFiYA4KO3C16KytfuFmIEIJHJI70Z32YReFAwAO1DLknk1rcthS4qgE0Xihkcblbgj1rDDoyW8zSQPtJGNrcimTUq1u8eGNI4nKO3JI64qvaonpOzz99bXC3svjKd4PYdfis/gSsecDA7npWh5Hk5dmY+pNUKkiqqyLoAFG7avJ9T0rVAAjeHnO9Tn3rOi4JNSVirIw4IrNXoMXWzrSPBIF7qcg+tNNNnjEAKxIxH1ArmshRLyIMDhh1HpQ41uLFg6ZwehHepupKvJVXB34Hd/qNs9k4iiiAUclIyMnoOT/ivOyAu2GOD69qK13Lc+RiApO44qkoz81SMaRPJPkxtoBEazRysq5XK5Ycml7W8lu8jzIemVz3zQlPFXMjFNrElfQ0OO2zctJfhpg1FmhVWGdp4rTdXcTW8sskSrMcCPHasUdhK0ReJSyseMGs9+k0JWOZSpxkA0nGLlSHuSjbMrHmu1VRk5rpNXIEqDrU61F4bmsY9Fot3GIjHMskjpjaFcLx75puviSusjp4ajou/cT/AGrzGmXEVrNvm+kqRn0p1+3LcsI4W3Me5BrjyRd6R6GLIuCtjF5ViTBPavPag4MNxIyEiQ4XnsP/AH5/Cm/hvMviNznpmsmq2+bUgdhWi6pAmrTZ5wY2McdMYotrcGC4WRexyKoyGMEN0PFCAI44IrrRwvTPZWsNnq7i4SMCWJQNgPL1fVdJit4lklhaG5U5G89vikn2f1ttMFyihd08e1ZCM7D7V63W7q9vtDsbu5uIpJXh2sSAGwen41CTcZbLR2tHhNSufvE4AP7tOFFZmOK2/suU8xkOR6GsEisjFWGGBwatGvBKSfbD2s8sbbUbCk5IPT5r0UM9xDp6tKMrgFG/qU15rIRQB+NNPvEf3CFY8g8q3NSyRstilV7Nj8+bGTV9PZYpTuJ55z70s8eURjODgYqR3DOwCg8etIolHPeh4YYWmaTGW9TQ7u38aEqpwT0Ndth+7GTkmrSShF5pE9lpK4nm5NOkjfG0t74oUieDKqjrjnBrdqV85OxWxn0pYGwa64NtWzgmknSDMHe5QKCc4C16C9t4LSygeWGSOTOHLDH4UkhnjUAtGxkQgo6tjaaYa3rjarp9tEyOJYWJlcvnf6Gs7uqFVd2Y5tTGWEaeU8DNEtZ5Li38zZI4pfa28l3OIYsbiCefQVuj06ayYPO6qu4r5W6kdqnKMUqRaE5N2w1rELfDjzOTzTLThbrdFy21nGArdj81IbKRkDCPcx5UA+1LrhtqlqmrkyjSih3qNkI18aElHB8w9RWG4lubRFeVmjV13KSeor2P2dt9O1+xuC7ustuq7kJGOR3P4V4r7ZOq6itqIliNugVgj7gT2oxcm0rFfGm6FK8dBV2O4ZxjAqqEYrkzhUIB5NUZNGI+Z8mudyamfSoB61QmdHqaETk5orEngDAqpjYDPaiA6DlPipCBu5ricVeDCsSefSsY0RAOzhjg7citkEzRqu8ZGOtAWINIniHb0z8VSe5Z3bZxGOFqTXItF8R1DPESp3deKwa9u8WLzZUrwPelhnk/q6elRpnmOZGLEDjNaOOnYZ5VKNHMVVemO4q4qoHJPcVUgM9Ek2yuvtmnsuGQc4rzelH/AI1V6bgR/an7DC5Y+UDpUZrZ1Yn8RZq92FRbZANx5Y98dhSfo3FXuJPFumkJzuY1UiqxVI55y5OywJHIPPUGmsGp+WTxTJ+8X+Qgc0oHajLDLNbkxRlgn1EdqWST7DFtdDmXWYGgt0EcrNCuPPJlTz2HamNr9tDDAYTaEqxJysmDyMYrxZyDWmxjL3cIKsRuGeKnLFGtjrJK9H1Cw+1cIha1GloAsYBLyccj4pVNfXEl5bovljJZpAkhYZx1rAb2ONWgAbMjBcntW23spLBnkkbKMvlGa5np0dKWrslxKCwGcDPJoaXKEnaNxPfsKy3shMUjjsK5pilLdd1VqkTu2MPE4JPQdT6V5TU7trm5L/y9FHtTjWbkQ2hUMN0nGO+O9ebLb+tWiiMmFQZrrcKT6UKN9rBW60UnJx61QmU2UK4XyZ9DWhR5RQrj+E/4UDGeKUxPlT81aeZpB14I5oJHFW2lcA/NGldm5OqCW3LfAorjIqlmOXPxRmGTWsyQNRXSM1Y8CuN5cDueaAQ9vMyo4ViCoyMGs134k4SRzyRgE1ZW2H8Oa2X8atpyZOHQA4qcqjJP9HjcotfgnEbgHjPxVTkdRVwcdKm9gev51UkUrSItsQZupNCiXfKAfmtd0CEXHQnBpZPdDxjpszSMHUY4AqsMnhzJJj6WBroAZcE4xXIgDIM/TkUfAN2evtZgEAJOwjK/FduSJDtA4IqlhEBBh+V6iiBfLkHGOCT2FcN0z0qtHm9U8twE48q/5rAeTWmdxNNJKecnIz6dqz/zV2x0jzp7dhreLxHx2HJpgJp4bcxLK3gbgxjJyvHestmP3ZPqa1Y3IQaF26HSqNhoH8I7lVGb2NBlhhlcs0LAk5O01ibIwagZx0Y0lNeRrT8B5LSDqGkB9KBPL4aCMAgDpUEsgOc5qxmJ+pQaKvyK68ABMzYDMce1MLMNJ9AOBWcTgfykfFaLO/SFmDZwwxnHStK2tIMEk9sdW6ERj1rDqdwIUJPU9B61uE8aweIGGzGc5rzF9ctdTs54Xoo9BUccOUtnRlnxjSAOxdiSck1AKmOwq3AGBXWcJZVcc8j4q6OQfMuaoGIogc96IBp9n4LX74zSXBhJUKg2bixJGQPwr0N9pcSKIp/3kkjMEjdCpjYsBlvTivGK2DkV6G5+1l7e6K1jcATTBNizk+cr6H1xzzU5xl2ikJLpjS5A0q+e1LZnjGGQDjP6Y5rzUTGW/hVE8RVYsyqM5UcmizX3/wAOQ5V/vzStG0x6+EB9P596V6XNc2+o20tsdsiSDbkcfB9qVRdMZyPRftmTS4Xe1VFc4yGQEMD64ry1zcPPM8rnLuSx+a9ZqdukwleFE2yMXcMOjegHpXnDYwyXLIJdg7CtBx7NKEqArJgE0B5DIeelWUHwzQ8YGTVUidliwAwBRILeSY+UVWGMuw/qPSnUEQijCrSTlx6HhDl2Yk009wWNRrLsODTNWYd6ix5NR5yL+3GhHNZyRebGV9u1CgOJPWvStCCOlI76H7ndBoxgNyPaqwnemRnjUdo5dS7pR8YOO1BU9qqBuU881dl2j/NOtE27dgz1rh4OR071M813OPimFLK3JFQfV81RD56seAfasYtyORWuTU5pbYxMeTwX7kVk6iqVqsKk10cJ8w+aKRQT1HzRzWAUPX4phorweOyXDSBZFwAnc+9Lia7G7IwZSQwOQaElaoMXTsf3KWgTbBAVOfqYVt0l2i4XHPY9OlJ1ukdBliCeue1Htr+OHksePRa5XF1R0qSuw1yJ4WBZywVuPLT68vDMiZPlCgik02tWUlt4ZilL9jwKWy6s2cKvkxjDGgoNvaGc0vI+SNLi2uNz42ISMdzV7ICK0Uy8Lj6h2+a8v+0ZZHCqwUEgYHSnWq3qRWQt4pAzNw+09BTSi7EUlQq1K7N3cMw+gcJn0rIF4NWiXxZVQEDccZPatslg0SKTKh3LuGPTtV1SIu3sV7iJgD2rSTkAiqX9q9rL+8IyGKkDsRXIm3YX14phTSsE20nw2x1H480O4R1hcspA45/GnFkqyh0Lbc5YD4wAKDq6Ys0x3jI+Nr5/3pVK2O40jz/YVY1w/wC9ddSpIJBx6HNMTDWf8596O1BtOA3zRX6DHc0Bio5b2FCLlpTirsNoNBh5JPvWMFIwK5PuKbi2VOAKuelCkBKEdxyK3ZugA5rhp1pWAkUe0MWwdpHUluf7CjG1H3UyMq53p6fSyt/vQ5boPHVie0XL5ol2WBHYHrRLNAGQEdwDTN1hubgCSNVjIY+Tj1x+VI38iiXxEDgcbR061BwMU1n06JJV2lgG2E/6d2M/lms2oWiWlyqAkjBzn1DEH/FOnaJtUx/YsTboeoK54+KHqk3g2blThn8o+TQtKm/8PCk8oSBWHVrnxJEjzgRjcfk1yqPzo7ZT/wCdi5hgUInDH4q8kmeF/OhE812JHC2brI7kA7CtO7GRWSxP7vFGyS1T/wBFf8gmGS2OxqlXk4c+4qhovsVdHKlSpWCQ1V22qcDmrGqv9Jz3rIDKLO4iMO87Cc47VXoMmh4ycUTouT26U9E7sgOP96mSagXjmu1gHa6CcVBXQOKYBcHjNWRiCCDihVfPNEx6iC5hvNKQyXaw3KyEP4gGNpHUUGxMa6hEslzHPCGBcxxkcUhicjOMZx6VaDU5bdtyMqsO+ypPHXRVZNbPQ3F1GlvL4SiUs+3ZnBC+tKWbSWc+NFcwuevm4rK2p3DqfMpUnJ8grK9yzdcf+kUFCjOdoIQFSs2dz89qJI/PJoSd/emSFbGGnIGYue3ApiXwKy2ibIgKuTzXPLbOqCpBQ/NGRuayqea0RHmlHRp6ilutRZgV+6H+1NoxlazahFvtpF9qeLppizVpo86uNuVPTmpuLoT1PcVWLuvrUXykg5Haug4ymOeKsRxUrvaiKDj60U0JKLmiY5Gcr8cVw9OO9SM+ZhXM0DHG6iinpQm6gVcnisEq5xgVZaETlqsGwKwAjZK+UkEelcYnA5PSqA5NEI3LxQGKzTPNjcAABgYGKH0ppYWttNGplZg3mJyOMAcdKJDpcczzAYBiVnYYPQUE10g0+zJY28Mwk8V3TauRtXOT6UyOmRb0hhlG5hkbj7Z9KBJFHBEBAWIkAZc09sUW7WwjWEeJDMTK+eWBwBSN7Q6WmIvuwgYMrFsBs5HQitKOk0YRm74GB5uF4Hxmm95YWwF8ZZwgilXaqjJbIH9velEk1kl3i2YhNx68cE9DxWZkvILW0MlxLtBJBR8DnqorDYxM93FGQVDMASQePevSk2otruRZh4kjKFRFOAAcf70Kwtx9/kLweRVjxlRxhkyf81udm4UZJUt4E2NOGkwOBjrn88Yq13EJ4S4nXAjLYdsnGAOMe4oV0guplY58fowzjODjNB1S5W3hktIOSTsdic7QP5Qe/ua270HSWxVnpXTQ+SRmrlcEjuKoRNFrzv8AmicBvgUK14LVphgadyFwB6noKRuiiTekZ5MtgDvRLi38CbAGFbkVuXTJUHiAB1BzkVe4hNzHjoynPXn8qTnvQ/t62Ky2OKGSew5rWbXZyeaBJgEgVRMm0NLWwmEiu0TiPGSBwcDjg/jWq3tru6tjHHCBgLuJU7shuOO9NfsgZRb3VyzyN4cQRh9XPXj5GKu+oym8guoFZUTuARhs9/8ANRc3ypF1BVs80bCZbplLogUnrkVobT5o5tj8MV3Z6jngCvVK8dzqEReSPeJBnoSwx0rPrN34BlMcSFIpgHBY7lx3FaLbVmaXR52WVJFEONrjA346YLdf7Uv1uRbidpk+l5GI/HB/3NNUmeW7fxoI2jQBm9SP9+TWDWwEtbcC3SNuSdgP04wCfmnjKtE5RtWYba78GF4znkgg1nkkaWRnbqxyaPaWhuk3btvm2jPGeM9aNLpTxXRt2yHUBiNwJxt3f4p9JiNycf4YKG1GuEELhQ24EAg49aATmnQjNmn9DWg8NWO1cRk5PWtHiBjkVNr5Fov4nJ8bwSccelDyp/mH41LpvMMUIHHJpmifKgxBAz29RXKrDz4h9q7QaoZOy3ahzdBV+g5oedzD0rI0mUjTjdVnHIH50QKBgenJoLHL03YnRY9K5UJzya5WMXFWFUB4q6HjJphTtQdDiq7s9Kt0A9aIDqnBoNyuJMj+bmijjFS4XMeR/KaxgMMxj4IBU9RVmMZbK5we1BFXzgcUoyI3JokMeZVHbND7itFkQZjnrjillpDR2xmgAWgSvscA9DRu1ZrvlahFHVJ0jSvIoqZzWe1fcgrUopWPHaNkB4qXX8F/g1WGrzDcpHrWMeSCk8r9QqynxAd3WowKSOPQ4roUgH0JrqOEqRtOMVD0qMeeOaqTxRAVU1cGhirCiA4D5zXar3rp6VjHCcmj26eNKiHoTz8VnplpMPieI4YDaAOaWbpWNBW6MU+DIxAxzQ6LIrCRuMjNdiiDTICARnkVl0Z7YIVdSfz7Uz2RvFJ4UWCGztVQeMetNbLTrUCKS4QynxVUopUZBGetByCoiy0j/eIpyAAAcDPzXpdOjth4oSIK8gcH4IqtxbWNj4qi6jSWOQDwzyfXr6UstroC4z46jkkEnjpUr2mdC4pNMZrosS6bHJJuLbRsKkAde9XjNtFLcQW8EqBz5DnlPxqlvqyz6clpIVcLIMOi4/A0ztdMj+7as0igyRxrtyeRk9RUpNrsZJeDKbFPuNxPbsjSpFudJHHmXIGPmvOnSC0olQBVIZirHkY9u/WtlwYLIMjTI7kZbBzV7LXIktHjkDFSRucJyRkED4prl2gVHpmOxCm1nfw3ASTaM5BJx1P6UTT79zdebIVgFJJ4xkfpW97qzv7KeO1crKMMFdcZPPek1in70qzquB1J96btCW09Gm8SMSQldo3Mw9c45zXnGAzg54pxqGX1KO2ifeIAVZh03Hr/ALClYQrkb9pHZqpHSJzdkiRG6xu3wa0mwmYFktmC+m7JFZxLPHwshAPPlbrTTTWgaINcSyEjgqr4P/uKE5NK0NjgpOjIkDW8mJYyp67WHWve6FB4+nWh8PYXUktHhSeT7Vgi+z8GpxwyQyGBX+mQksxAOTkeuOnxXtvs/psVlafd2kJS2Zl3vgEjdxn865pT9zS7L8HisPZ6Vts5QZrjzDGCw9c0nuNNi8fZIhm38fvApx+Qz/evXqAF29qGLWITrL1K54NUlgeqJLNt2fL9T+zsNrcmGOf7xtHOW2np6YpKmlRShm8M+Vd7FZM4HrXvNYgijvZJBLmUq2R80msrBYZSoYMJ7ZgRj6aGOXJ0NNUrGv2X00aWl1Hv3q7K6tjGQVojadM6f8UoxL5xwBnsP8Vo0xmfS7KRoypeIAt/URxXby5cPFvXMMalGb0z0zQQWeNuLeXSr8zSo4DkmI4zkgiq6xqZeR52Xwyr43BfqyKca9b3dw8D6c2Ei+pxyFJPFeb+0GploorCd2nMLFndVG3Pp70yd6B1sMt3bQ2b3ShHMwCxrJ0DDqR/+96XapcwyQOGYGVscd+aFPNA9nbgt4aAHhU68/NL72aO5nLjIyRwMDAFUjFXYjm6odWzRRxwqoUhUPbIJxWq7aFtVkkPGQoyfZMVq0rToH0azmRwssxZAHHGFHJz81ht4A8w/do7lsKT0FLq9DNutiS6tQ5j2DI2UAWgzzTz7Q24jlWOJ0ieIlZPT2pSiyyvshDyH12HmqK6JvjYI2wFC2tG4APFapopoiQ+0kcHa4OKzk5PmyKZCuis7ZYZ9KFuqStucmq0whph4hY+proriA/dwB1Jrdb2qRJvuBvbsvYfNJNpFMabF8jc4qR9M1LpAkh2fT6elUQ+Q/NFdCvvYYnAc/hQQMkewojkgYzVVIVee9ZAZwjmuAVC2e1dUg0wCV3tgniu4Ga6owcHpRAWjC9qo7ZmwOgrpXY4I6UJTglvWiYIx5HtRfqDD1FZycnFGQ4NYBl6GumrTLiQ8cGh0Alj1rqsVYEHBFczzUoBGUF4jgBztarTlWHBBpXUyfU0nBeCnuOqYzs2wSvpW9WpHZybJxk9eKcRtUsipl8UrRsiOKK5zWeJqMw4pEVZ5/Uo/Cu344bzChLyMUy1ePdEsg6qcH4pWp5rpg7icWRVIpIMN7VyuynzD4qgNMTOlfSpg1MmmWm6RNeEM+Y4f6j1PxWboKVizBrvhse3516r9h2I7yJ/+VcOh2XUXMg+cGk5ofgzzIgYDO1iPiu52cYK16sabGqAJcgY6DaQP81BaHkNOhGOuCP85pXkGWM8oSHOS/51s02JfGJ2iQgZAz0prLYCQkKtvJj1IB/xWzQtHktZpJZEUBoztIcGs5poyg0zMwdYG8O32nOCB3zWnZJcW5/c+EQVOFx2FGuxJJC0jkeHwisB6dqWxahJGhUPsAI5I54pV/Bn/Qs0f7RuhbjEF4icF+BIMf5pWNNmw/ADRttbJ4FekabTXkiubgFp9oO7aSSfX2rJqc9tN4fmlEc0hchRhugHNBNozSewWkIpnjth5thBY+9e1MFv4U6gkM+xXQLwwweSa8lbR6VZSCWK+dZAAeDn862SatAVM5un2vhC6jByPb4pJK2PHSPO67a3em3Phynfbs2Y3xzj0zWGWVoY1ZH3o56fFOdXmsbmEBZbiU9een96R/s91g8Yjy8Hp61eLVbIyTvRq0ueUCWQuQoH0g9T2rVb3E/iyTiV8gjn8aXWuVDDPBrdbuBG6+ppZBiwj3kkM+xURckHK5Gec1hu7o3DPmNAWPLYyaM/nmB9Kzsg3HNFUZ2CVa5uKsQK1Ki+tPLLQrQxRz3DvKXG7YnAA9CaDml2FQb6DfZDV2tGQyHegDKytz16Y96efaLVZbizTwXO1pfO6H6x2ytI7vS7bT7drmKUxkkARNk8+xoemE3M+CX2kcgf2rkkk3yR3QrjT7PoP2XnZNGhMsryM5LeY9B6VsvNR8J1UHBKMfmvESapdWhihnbaCmVGegrQmtvcbissaSoh2lj19h70y5deCDUbbD6lMZtqiMW0ioSzydzjp+NIrS5uvDJP1OcADk4ol8s2oGWaZ2MnGeatbaatqYGQT/eN2Tk4UjtTqoPQHc0O9M1iCHTreK4nCCJdpD8bTWm2vLe8knWOQOOBj1GK8pr12kqR2bxBZ2JZto5PzQLO5mtbiKZY3LINrb34Ip4q9oRuuxl9pWk0bS4EgZdl5IzEI3KheAK8gY5JlDRQTFegPiHFel1+G+v4IoxakiJmYlfc150tLBgKzLjt6U0KSFndhrrTpjbIxgztALADoD6c1LKztrw7AscM39LkjPuP/wC0OS6lEQ2sPMMHyiskjtLIviEsRwM9qbYuj285GzTrKJVAtbYoxHHmOSTWKyhMEz+LMmyHPIPU+3rVWvLeF3Uq6uF25Bz2rEGM0irG2VUknrxSNUOnZbV5JDNc3EQUyNtODXnpbq7kJSWWbBPKkkD8q9nNa7LC4ulBZkiBORXm4cX90XxIqr/EH9XtRU+2BwbpGKG1uZWG3fwOMnAFajYSxSHxBu9SvNN0tLdkEgikQg8bs0O6QkZBwR3FI8rbLLAkti25iiYBDH5x/WMVjFkryBOUz3HIomotcrgmRmReAD/LVLK7KODz4g/mPOP0q0U67OaVXTRvXSJLaRFnZCvUbT1/CiXKqkZ3nGO9DN27TqZJN2RjntRpQty8iFwYlwAB3qU2+Wy+OlHQkm8wLA5XOKADgGmt1aJjhcH2pZJEydjnNWhJNEJxaZZvNj4qFcHJ5qqcjnIqHjoaYQ7VSK6G55q3T0ogLKdw9xVsZoanB6UQGmQDj9PwoGfSrzPg4HehigYsn1ZooPNDWrZwKJi7uR349KGRG/UbT6jpXHbNUzShJXKlSsY7XDUqVgEU4YEetOYiSB7ipUqWU6MJqiPStfVKlSpI6GZboBrWUH+k15/OKlSrY+mc2btF7yNYzGVz5kBNZ81KlUj0Sl2N9EhiLb3jVyOm6vS/WnPHxUqVORSPRluR4e0qTye9LpdQmWUquwAf6alSpsoi9tdzJKV37geTu5pmrlgCQMmpUqbKFlUM4HTceSKLcyNDrun26fw9pBHru4NSpTREkKy7eLPbElo0kOM9az+BGxtFIz4kmGOevNSpVCYPUJGW9n2HYN5GF4GBV7tmJQFiQFBFSpWMZHHSvRXNpCNOfCAFQhBHqalSln4Gh5L6TZW5iWR4hIwYjz89q7qbG2jtFQ5jZNxRgCvU8fFSpU19h30Kb5Y44FCQxqzOWLgc9OnxWJWO6pUqq6JvsspIcYoM/DVKlFdg8Agxphp93MmUVzt+alStLo0eyuqzyP4aM5IPPJqsU0kMkYSRgGXJ596lSlSVD20z132e0a01VJpbxXkdGAB3EcUL7T2FpYzWsVrbpHkklhksfzqVKS3zob/Nh7Vtlzb8A5IU570++3kxge3MSquyPcMDvUqUvhh8o+U31zNNdm5kkLSyck1s0edmuD4irL0wH5AqVK6H9SC+xp1GV2uyS7ck96zXkSopIznjvUqUq8DPyZX+laCT581KlOIz0VzGv7ShOP41uGb5K1mtZWt52VDwRjmpUpZDRPVXE7W/2RlukVTKZ0j8w420ju5ytvHKiojN1wKlSufwdMPsEhkaSBS5ySKDKAPxqVKUuxPqDFH2gDBHegaa48bwzGhU+o5qVK6YfU4sn2BakNrqy8H2oujOzTEE5zUqU0voJD7jK4UFsUN4USJmCgkDvUqVzo6mI5ZGkY5x+AodSpXYujgfZCMjmrJ5k57VKlEUqSVOAaLngGpUpkAzscsc1BUqUAllNWPSpUrGKGuVKlYx/9k=",
  p5: "data:image/jpeg;base64,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",
  p6: "data:image/jpeg;base64,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",
  p7: "data:image/jpeg;base64,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",
  p8: "data:image/jpeg;base64,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",
  p9: "data:image/jpeg;base64,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",
};


/* ---------- extended profile data ---------- */
const PROFILE_EXTRAS = {
  LA: {
    lastPost: "2h ago", workingOn: "FFG Digital — the venture arm's technology platform, plus this app you're holding.",
    interests: ["Tech & AI", "Startups", "Music & culture", "Finance"],
    contentTypes: ["Builds", "AI workflows", "Behind the scenes"],
    links: { linkedin: true, website: true },
    baseMatch: 92,
  },
  FF: {
    lastPost: "2h ago", workingOn: "Cohort One of FFG Digital — five startups advised, powered and part-owned by the mission.",
    interests: ["Startups", "Community work", "Finance", "Education"],
    contentTypes: ["Announcements", "Impact stories", "Opportunities"],
    links: { linkedin: true, instagram: true, website: true },
    baseMatch: 88,
  },
  FE: {
    lastPost: "3h ago", workingOn: "September's Summer Rooftop Social — 200 members, one skyline.",
    interests: ["Community work", "Music & culture", "Food"],
    contentTypes: ["Event recaps", "Upcoming events", "Member moments"],
    links: { instagram: true, website: true },
    baseMatch: 84,
  },
  AO: {
    lastPost: "5h ago", workingOn: "Kindred Labs' first corporate pilot — AI hiring without bias, now in production.",
    interests: ["Tech & AI", "Startups", "Education"],
    contentTypes: ["Founder journey", "Hiring", "Wins & lessons"],
    links: { linkedin: true, x: true, website: true },
    baseMatch: 94,
  },
  KB: {
    lastPost: "1d ago", workingOn: "GoWave's data platform launch and the next market expansion.",
    interests: ["Finance", "Startups", "Tech & AI"],
    contentTypes: ["Fundraising", "Payments", "Founder life"],
    links: { linkedin: true, website: true },
    baseMatch: 89,
  },
  SF: {
    lastPost: "2d ago", workingOn: "GoWave's diaspora payment rails — reliability work nobody sees but everybody feels.",
    interests: ["Finance", "Tech & AI", "Food"],
    contentTypes: ["Payments deep-dives", "Office hours"],
    links: { linkedin: true },
    baseMatch: 91,
  },
  NC: {
    lastPost: "6h ago", workingOn: "Mentoring 12 founders this quarter and a brand clinic series for the community.",
    interests: ["Media", "Fashion", "Startups", "Education"],
    contentTypes: ["Brand teardowns", "Mentoring", "Talks"],
    links: { linkedin: true, instagram: true, website: true },
    baseMatch: 87,
  },
  MJ: {
    lastPost: "3d ago", workingOn: "Deploying a new pre-seed fund focused on overlooked founders.",
    interests: ["Finance", "Startups", "Sport"],
    contentTypes: ["Investment theses", "AMAs"],
    links: { linkedin: true, x: true },
    baseMatch: 90,
  },
  DJ: {
    lastPost: "8h ago", workingOn: "Root & Rise beta — 100 members in, marketplace vendors onboarding weekly.",
    interests: ["Wellness", "Community work", "Startups"],
    contentTypes: ["Startup journey", "Wellness", "Community"],
    links: { instagram: true, website: true },
    baseMatch: 86,
  },
  LH: {
    lastPost: "1d ago", workingOn: "Two brand worlds for Q4 clients and a design talk at Pitch Practice Night.",
    interests: ["Media", "Fashion", "Music & culture", "Startups"],
    contentTypes: ["Design process", "Brand strategy", "Talks"],
    links: { instagram: true, website: true, linkedin: true },
    baseMatch: 85,
  },
  TW: {
    lastPost: "2d ago", workingOn: "A sponsorship open call — matching corporate budgets to community programmes with receipts.",
    interests: ["Finance", "Community work", "Sport"],
    contentTypes: ["Partnership offers", "Impact reporting"],
    links: { linkedin: true },
    baseMatch: 82,
  },
  RC: {
    lastPost: "12h ago", workingOn: "Two v1 builds for FFG founders, both shipping before October.",
    interests: ["Tech & AI", "Startups", "Food"],
    contentTypes: ["Build logs", "Tech advice"],
    links: { linkedin: true, x: true, website: true },
    baseMatch: 88,
  },
};

const calcMatch = (user, member) => {
  const ex = PROFILE_EXTRAS[user.id] || {};
  let score = ex.baseMatch || 80;
  let shared = [];
  if (member?.interests?.length && ex.interests?.length) {
    shared = ex.interests.filter(i => member.interests.includes(i));
    score = Math.min(98, Math.max(score - 8, 72) + shared.length * 5);
  }
  return { score, shared };
};

/* ---------- tiny UI atoms ---------- */
/**
 * The Connect Concierge mark: two interlocking circles.
 *
 * Deliberately not a sparkle/star — every AI product uses one. Two rings
 * meeting reads as connection, which is the point of the product, and it
 * stays legible down to 13px where a star turns to mush.
 */
const AgentMark = ({ size = 16, color, strokeWidth = 1.9, style }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    style={{ flexShrink: 0, ...style }} aria-hidden="true"
  >
    <circle cx="9.1" cy="12" r="5.9" stroke={color || T.gold} strokeWidth={strokeWidth} />
    <circle cx="14.9" cy="12" r="5.9" stroke={color || T.gold} strokeWidth={strokeWidth} />
  </svg>
);

const Avatar = ({ initials, ring, size = 44, onClick }) => (
  <div onClick={onClick} style={{
    width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
    background: `linear-gradient(135deg, ${T.card}, ${T.ink2})`,
    border: `2px solid ${ring || T.line}`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: size * 0.34,
    color: T.cream, letterSpacing: "0.02em", cursor: onClick ? "pointer" : "default",
  }}>
    {PHOTOS[initials]
      ? <img src={PHOTOS[initials]} alt={initials} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      : initials}
  </div>
);

const PillarTag = ({ name }) => {
  const p = PILLAR[name]; const Ico = p.icon; const c = T[p.k];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600, color: c,
      background: `${c}1A`, border: `1px solid ${c}40`,
      padding: "3px 9px", borderRadius: 999, letterSpacing: "0.04em",
    }}><Ico size={11} strokeWidth={2.5} />{name.toUpperCase()}</span>
  );
};

/* ---------- data ---------- */
const POSTS = [
  {
    uid: "FF", time: "2h", pillar: "Capital", image: "p1",
    text: "16 founders backed. £1M+ raised for causes. Scenes from our launch night — FFG Digital cohort one applications open Monday.",
    stat: { label: "Founders backed", value: "16" },
    likes: 482, comments: 96,
  },
  {
    uid: "FF", time: "3h", pillar: "Community", image: "p5",
    text: "Golden hour at the Summer Rooftop Social. 200 members, one skyline, countless connections made. Next one lands in September — watch this space. 🌇",
    likes: 398, comments: 71,
  },
  {
    uid: "AO", time: "5h", pillar: "Connect",
    text: "Matched with my mentor through the app last month — today we closed our first corporate pilot. If you're on the fence about the mentor programme, this is your sign. 🚀",
    likes: 231, comments: 41,
  },
  {
    uid: "FE", time: "7h", pillar: "Community", image: "p3",
    text: "Last night's members' mixer. Three intros made on the spot turned into meetings booked for this week. This is what the room does. ✨",
    likes: 264, comments: 45,
  },
  {
    uid: "DJ", time: "8h", pillar: "Community",
    text: "Root & Rise beta is live to our first 100 members. Every vendor on the marketplace is from the community. This one's personal — thank you FFG for powering us. 🌱",
    likes: 187, comments: 34,
  },
  {
    uid: "FE", time: "1d", pillar: "Community", image: "p0",
    text: "150+ events hosted and counting. Founders' Breakfast is back at Shoreditch — 30 seats, real conversations, no panels. Doors 8am Thursday.",
    event: { name: "Founders' Breakfast", where: "Shoreditch, London", when: "Thu 8:00" },
    likes: 310, comments: 58,
  },
  {
    uid: "LH", time: "1d", pillar: "Connect", image: "p2",
    text: "Studio LH has one client slot left for Q4. Founders: your brand is the cheapest multiplier you're not using. Come find me at Pitch Practice Night.",
    likes: 156, comments: 27,
  },
  {
    uid: "KB", time: "1d", pillar: "Capital", image: "p4",
    text: "Term sheet signed — and celebrated properly. FFG took a stake, but more importantly they built our data platform with us. Advise. Power. Own. It's real.",
    likes: 542, comments: 87,
  },
];

const SUGGESTED = ["RC", "TW", "NC", "MJ"];

const MATCHES = [
  { uid: "SF", why: "Shared sector: payments", score: 94 },
  { uid: "MJ", why: "Looking to back pre-seed", score: 91 },
  { uid: "NC", why: "Requested by 12 founders", score: 88 },
];

const EVENTS = [
  {
    id: "breakfast", name: "Founders' Breakfast", where: "Shoreditch, London", date: "31", month: "JUL",
    tag: "Community", spots: "8 seats left", time: "8:00 – 10:00 AM", host: "FE", image: "p6",
    about: "Thirty founders, one long table, no panels and no pitches. Bring one problem you're stuck on and leave with three people who can help. Coffee and hot breakfast on FFG.",
    agenda: [
      ["8:00", "Doors, coffee and introductions"],
      ["8:30", "Table conversations — one problem each"],
      ["9:30", "Open connections and next steps"],
    ],
    going: ["AO", "KB", "SF", "NC"],
  },
  {
    id: "pitch", name: "Pitch Practice Night", where: "FFG HQ", date: "06", month: "AUG",
    tag: "Capital", spots: "Open", time: "6:30 – 9:00 PM", host: "FF", image: "p9",
    about: "A safe room to pitch badly before you pitch for real. Five minutes on stage, ten minutes of honest feedback from founders, mentors and angels who've heard hundreds.",
    agenda: [
      ["6:30", "Doors and lineup draw"],
      ["7:00", "Pitches — five minutes each"],
      ["8:30", "Feedback circles and drinks"],
    ],
    going: ["MJ", "KB", "LA"],
  },
  {
    id: "ailab", name: "AI for Founders Lab", where: "Online", date: "12", month: "AUG",
    tag: "Connect", spots: "Waitlist", time: "12:00 – 1:30 PM", host: "LA", image: "p8",
    about: "A working session, not a webinar. Bring a real task from your business and leave with an AI workflow that does it — built live, step by step, on tools you already have.",
    agenda: [
      ["12:00", "Three workflows, built live"],
      ["12:45", "Build your own with support"],
      ["1:15", "Q&A and templates to keep"],
    ],
    going: ["AO", "SF", "NC", "MJ"],
  },
];

const ROOMS = [
  {
    id: "fundraising", live: true, title: "Fundraising in 2026 — what's actually working",
    tag: "Capital", speakers: ["MJ", "KB", "LA"], listeners: 142,
    desc: "Angels and founders comparing notes on the current raise climate.",
  },
  {
    id: "firsthire", live: true, title: "Your first 5 hires",
    tag: "Connect", speakers: ["AO", "NC"], listeners: 87,
    desc: "Hiring without a brand, a budget or a talent team.",
  },
  {
    id: "wellness", live: true, title: "Founder wellbeing — the unglamorous bits",
    tag: "Community", speakers: ["SF", "NC"], listeners: 54,
    desc: "An honest room. No metrics talk allowed.",
  },
  {
    id: "diaspora", live: false, when: "Today 7 PM", title: "Building for the diaspora market",
    tag: "Capital", speakers: ["KB", "SF"], listeners: 203,
    desc: "Payments, logistics and trust — with the GoWave team.",
  },
  {
    id: "brand", live: false, when: "Fri 1 PM", title: "Brand clinic: live teardowns",
    tag: "Connect", speakers: ["NC"], listeners: 156,
    desc: "Naomi reviews member brands live. Volunteer at your own risk.",
  },
];

const FOUNDERS = [
  { n: "GoWave", desc: "Payments for diaspora businesses", stage: "Seed", raised: "£240K" },
  { n: "Root & Rise", desc: "Wellness marketplace", stage: "Pre-seed", raised: "£85K" },
  { n: "Kindred Labs", desc: "AI hiring without bias", stage: "Seed", raised: "£310K" },
];


const ARTICLES = [
  {
    id: "ownership", image: "p9", tag: "Capital", author: "FF", read: "6 min", time: "Today",
    title: "From access to ownership: why FFG is taking stakes",
    excerpt: "Opening doors was chapter one. Chapter two is owning a share of what walks through them.",
    body: [
      "For years, the work was access: getting people into rooms, onto stages, in front of capital. That work continues — but access alone leaves value on the table for the very people who create it.",
      "FFG Digital changes the equation. When we advise a founder, we don't send an invoice and disappear. We build alongside them — platforms, products, AI — and we take a minority stake in what we help create. Their success returns value to the mission, and the mission reinvests it in the next founder.",
      "This is the flywheel: advise, power, own. Five startups in year one. A portfolio that becomes the engine of the community. Ownership isn't a slogan — it's a balance sheet.",
    ],
  },
  {
    id: "mentorship", image: "p5", tag: "Connect", author: "NC", read: "4 min", time: "2d ago",
    title: "What twelve founders taught me about asking for help",
    excerpt: "The founders who grow fastest aren't the smartest in the room. They're the quickest to say 'I don't know.'",
    body: [
      "This quarter I mentored twelve founders through the FFG programme, and the pattern was unmistakable: the ones who moved fastest were the ones who asked the most uncomfortable questions early.",
      "Asking for help isn't a tax on your credibility — it's how you compound other people's experience into your own. Every founder who sat across from me and said 'here's what I'm stuck on' left with a shortcut that took someone else years to find.",
      "If you're in this community and not asking, you're paying full price for lessons that are available at a discount. The room is the discount.",
    ],
  },
  {
    id: "rails", image: "p4", tag: "Capital", author: "KB", read: "5 min", time: "4d ago",
    title: "Building payment rails for the diaspora — what nobody tells you",
    excerpt: "The technology is the easy part. Trust is the product.",
    body: [
      "When we started GoWave, we thought we were building payments infrastructure. We were actually building trust infrastructure — the rails just carry it.",
      "Diaspora money moves on relationships. Every transfer is someone's rent, someone's school fees, someone's emergency. Reliability isn't a feature — it's the entire brand. One failed transfer costs you a family, not a user.",
      "FFG's stake in us came with something more valuable than the cheque: a data platform built with us, and a community that stress-tested the product with real remittances before launch. That's what powered looks like.",
    ],
  },
  {
    id: "aiweek", image: "p8", tag: "Connect", author: "LA", read: "3 min", time: "5d ago",
    title: "Three AI workflows every founder should steal this week",
    excerpt: "None of these need a technical team. All of them are running inside FFG startups today.",
    body: [
      "First: the investor-update writer. Feed it your metrics and bullet notes, get a clean monthly update in your voice. Founders in the cohort cut update time from three hours to twenty minutes.",
      "Second: the support triage agent. It reads incoming messages, drafts replies for the easy 80%, and flags the hard 20% to you. One Root & Rise pilot handled its first hundred members without hiring support.",
      "Third: the meeting-to-action pipeline. Record, transcribe, extract commitments, push to your task list. Nothing falls through. At the AI for Founders Lab on the 12th we'll build all three live — bring a laptop.",
    ],
  },
];

/* ---------- splash ---------- */
const TAG_LINES = [
  { text: "Where the", italic: false },
  { text: "ambitious", italic: true },
  { text: "belong", italic: false },
];
const TAG_TOTAL = TAG_LINES.reduce((n, l) => n + l.text.length, 0);

const Splash = ({ onEnter }) => {
  const [stage, setStage] = useState(0);      // 0: dark, 1: logo, 2: tagline, 3: button
  const [visibleChars, setVisibleChars] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 300);          // logo fades in
    const t2 = setTimeout(() => setStage(2), 1600);         // tagline starts
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // slow-motion letter-by-letter reveal
  useEffect(() => {
    if (stage < 2) return;
    if (visibleChars >= TAG_TOTAL) {
      const t = setTimeout(() => setStage(3), 500);         // then the button
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setVisibleChars(c => c + 1), 85);
    return () => clearTimeout(t);
  }, [stage, visibleChars]);

  return (
    <div style={{
      position: "absolute", inset: 0, background: T.ink, zIndex: 50,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "48px 32px", overflow: "hidden",
    }}>
      <ZodiacField density={72} opacity={0.85} />
      <div style={{
        position: "absolute", width: 640, height: 640, borderRadius: "50%",
        background: `radial-gradient(circle, ${T.gold}22 0%, transparent 62%)`,
        top: "50%", left: "50%", transform: "translate(-50%, -58%)",
        opacity: stage >= 1 ? 1 : 0, transition: "opacity 2s ease",
        pointerEvents: "none",
      }} />

      <div style={{ flex: 1, position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 44 }}>
        {/* logo — larger with aura */}
        <div style={{ position: "relative" }}>
          {stage >= 1 && (
            <div style={{
              position: "absolute", inset: -50, borderRadius: "50%",
              background: `radial-gradient(circle, ${T.gold}38 0%, transparent 68%)`,
              filter: "blur(30px)", animation: "ffgLogoAura 6s ease-in-out infinite",
              pointerEvents: "none",
            }} />
          )}
          <img src={T.logo} alt="Forbes Family Group" style={{
            position: "relative", width: 264, height: 264,
            opacity: stage >= 1 ? 1 : 0,
            transform: stage >= 1 ? "none" : "scale(0.9) translateY(12px)",
            transition: "all 1.5s cubic-bezier(.2,.8,.2,1)",
            filter: `drop-shadow(0 0 30px ${T.gold}55)`,
          }} />
        </div>

        {/* tagline — editorial serif, slow-motion reveal */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.12 }}>
          {(() => { let offset = 0; return TAG_LINES.map((line, li) => {
            const start = offset;
            offset += line.text.length;
            return (
              <div key={li} style={{
                fontFamily: "'Playfair Display',serif",
                fontStyle: line.italic ? "italic" : "normal",
                fontWeight: line.italic ? 500 : 400,
                fontSize: 44,
                color: line.italic ? T.gold : T.cream,
                letterSpacing: "0.01em",
              }}>
                {line.text.split("").map((ch, i) => {
                  const idx = start + i;
                  return (
                    <span key={i} style={{
                      opacity: idx < visibleChars ? 1 : 0,
                      filter: idx < visibleChars ? "blur(0)" : "blur(5px)",
                      transition: "all 0.9s ease",
                      whiteSpace: "pre",
                    }}>{ch}</span>
                  );
                })}
              </div>
            );
          }); })()}
        </div>
      </div>

      {/* enter — appears last */}
      <div style={{
        width: "100%", position: "relative", zIndex: 2,
        opacity: stage >= 3 ? 1 : 0,
        transform: stage >= 3 ? "none" : "translateY(12px)",
        transition: "all 1.1s cubic-bezier(.2,.8,.2,1)",
        pointerEvents: stage >= 3 ? "auto" : "none",
      }}>
        <button onClick={onEnter} style={{
          width: "100%", padding: "18px 0", borderRadius: 999, cursor: "pointer",
          background: `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})`,
          border: "none", color: T.ink,
          fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "0.28em",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          animation: stage >= 3 ? "ffgCtaGlow 2.4s ease-in-out infinite" : "none",
        }}>ENTER<ArrowUpRight size={16} strokeWidth={2.6} /></button>
      </div>

      <style>{`
        @keyframes ffgCtaGlow {
          0%, 100% { box-shadow: 0 0 30px 4px ${T.gold}55; }
          50%      { box-shadow: 0 0 48px 10px ${T.gold}95; }
        }
        @keyframes ffgLogoAura {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.09); }
        }
      `}</style>
    </div>
  );
};

/* ---------- onboarding ---------- */
const ROLES = ["Founder", "Investor", "Mentor", "Creative", "Operator", "Student", "Career professional", "Community builder"];
const REASONS = ["Raise funding", "Find a mentor", "Grow my network", "Attend events", "Learn AI & digital", "Find collaborators", "Back founders", "Give back"];
const INTERESTS = ["Startups", "Tech & AI", "Music & culture", "Finance", "Property", "Wellness", "Fashion", "Media", "Sport", "Food", "Community work", "Education"];

const obField = () => ({
  width: "100%", padding: "15px 16px", borderRadius: 14, outline: "none",
  background: T.card, border: `1px solid ${T.line}`, color: T.cream,
  fontSize: 15, fontFamily: "'Inter',sans-serif", boxSizing: "border-box",
});

const Chip = ({ label, on, onClick }) => (
  <button onClick={onClick} style={{
    padding: "10px 16px", borderRadius: 999, cursor: "pointer",
    background: on ? `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})` : T.card,
    border: on ? "none" : `1px solid ${T.line}`,
    color: on ? T.ink : T.cream, fontSize: 13.5, fontFamily: "'Inter',sans-serif",
    fontWeight: on ? 700 : 500, transition: "all 0.15s",
    display: "inline-flex", alignItems: "center", gap: 6,
  }}>{on && <Check size={13} strokeWidth={3} />}{label}</button>
);

const Onboarding = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [p, setP] = useState({
    name: "", role: null, reasons: [], interests: [], project: "",
    linkedin: "", instagram: "", x: "", website: "",
  });
  const set = (k, v) => setP(prev => ({ ...prev, [k]: v }));
  const toggle = (k, v) => setP(prev => ({
    ...prev, [k]: prev[k].includes(v) ? prev[k].filter(x => x !== v) : [...prev[k], v],
  }));

  const STEPS = [
    {
      eyebrow: "FIRST THINGS FIRST", title: "What should we call you?",
      valid: () => p.name.trim().length > 1,
      body: (
        <input value={p.name} onChange={e => set("name", e.target.value)} placeholder="Your name" autoFocus style={obField()} />
      ),
    },
    {
      eyebrow: "YOUR SEAT AT THE TABLE", title: "Which best describes you?",
      valid: () => !!p.role,
      body: (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
          {ROLES.map(r => <Chip key={r} label={r} on={p.role === r} onClick={() => set("role", r)} />)}
        </div>
      ),
    },
    {
      eyebrow: "YOUR AMBITION", title: "What brings you to FFG?",
      hint: "Choose as many as apply — this shapes your matches, rooms and events.",
      valid: () => p.reasons.length > 0,
      body: (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
          {REASONS.map(r => <Chip key={r} label={r} on={p.reasons.includes(r)} onClick={() => toggle("reasons", r)} />)}
        </div>
      ),
    },
    {
      eyebrow: "YOUR WORLD", title: "Pick your interests",
      hint: "We'll use these to suggest rooms and people worth your time.",
      valid: () => p.interests.length >= 3,
      body: (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
          {INTERESTS.map(r => <Chip key={r} label={r} on={p.interests.includes(r)} onClick={() => toggle("interests", r)} />)}
        </div>
      ),
    },
    {
      eyebrow: "WHAT YOU'RE BUILDING", title: "Tell us about your current project",
      hint: "A sentence or two is perfect. You can refine this later.",
      valid: () => true,
      body: (
        <textarea value={p.project} onChange={e => set("project", e.target.value)} rows={4}
          placeholder="e.g. A payments platform for diaspora businesses, currently raising pre-seed…"
          style={{ ...obField(), resize: "none", lineHeight: 1.5 }} />
      ),
    },
    {
      eyebrow: "BRING YOUR WORLD WITH YOU", title: "Connect your links",
      hint: "Optional — but members with links get 3× more connection requests.",
      valid: () => true,
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {[
            ["linkedin", Linkedin, "LinkedIn profile URL"],
            ["instagram", Instagram, "Instagram handle"],
            ["x", Twitter, "X handle"],
            ["website", Globe, "Your website"],
          ].map(([k, Ico, ph]) => (
            <div key={k} style={{ position: "relative" }}>
              <Ico size={17} color={p[k] ? T.gold : T.dim} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
              <input value={p[k]} onChange={e => set(k, e.target.value)} placeholder={ph}
                style={{ ...obField(), paddingLeft: 44 }} />
            </div>
          ))}
        </div>
      ),
    },
  ];

  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  const finish = () => {
    setFinishing(true);
    setTimeout(() => onComplete(p), 2200);
  };

  if (finishing) {
    return (
      <div style={{
        position: "absolute", inset: 0, background: T.ink, zIndex: 49,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, padding: 40,
      }}>
        <div style={{ position: "relative", width: 92, height: 92, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: `2px solid ${T.line}`, borderTopColor: T.gold,
            animation: "ffgSpin 1s linear infinite",
          }} />
          <img src={T.logo} alt="" style={{ width: 44, height: 44 }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 20, color: T.cream, marginBottom: 8 }}>
            Welcome, {p.name.split(" ")[0]}.
          </div>
          <div style={{ fontSize: 13.5, color: T.dim, fontFamily: "'Inter',sans-serif", lineHeight: 1.6 }}>
            Curating your rooms, matches and events<br />around {p.interests.slice(0, 2).join(" and ").toLowerCase()}…
          </div>
        </div>
        <style>{`@keyframes ffgSpin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, background: T.ink, zIndex: 49, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <ZodiacField density={38} opacity={0.35} />
      {/* progress */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 14, padding: "18px 18px 6px" }}>
        {step > 0
          ? <ChevronLeft size={22} color={T.cream} style={{ cursor: "pointer" }} onClick={() => setStep(x => x - 1)} />
          : <img src={T.logo} alt="" style={{ width: 22, height: 22 }} />}
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: T.line, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${((step + 1) / STEPS.length) * 100}%`,
            background: `linear-gradient(90deg, ${T.gold}, ${T.goldSoft})`,
            transition: "width 0.4s cubic-bezier(.2,.8,.2,1)",
          }} />
        </div>
        <span style={{ fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif", fontVariantNumeric: "tabular-nums" }}>{step + 1}/{STEPS.length}</span>
      </div>

      {/* step content — vertically centred */}
      <div key={step} style={{
        position: "relative", zIndex: 2, flex: 1, overflowY: "auto", padding: "26px 22px",
        display: "flex", flexDirection: "column", justifyContent: "center",
        animation: "ffgStepIn 0.5s cubic-bezier(.2,.8,.2,1)",
      }}>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 10 }}>{s.eyebrow}</div>
        <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 28, color: T.cream, lineHeight: 1.2, marginBottom: s.hint ? 10 : 26 }}>{s.title}</div>
        {s.hint && <div style={{ fontSize: 13, color: T.dim, fontFamily: "'Inter',sans-serif", lineHeight: 1.55, marginBottom: 26 }}>{s.hint}</div>}
        {s.body}
      </div>
      <style>{`@keyframes ffgStepIn { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }`}</style>

      {/* actions */}
      <div style={{ position: "relative", zIndex: 2, padding: "12px 22px calc(18px + env(safe-area-inset-bottom))" }}>
        <button
          onClick={() => last ? finish() : setStep(x => x + 1)}
          disabled={!s.valid()}
          style={{
            width: "100%", padding: "16px 0", borderRadius: 999, border: "none",
            cursor: s.valid() ? "pointer" : "default",
            background: s.valid() ? `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})` : T.card,
            color: s.valid() ? T.ink : T.dim,
            fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15,
            animation: s.valid() ? "ffgCtaGlow 2.4s ease-in-out infinite" : "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.25s",
          }}>
          {last ? (<><Rocket size={16} />Enter FFG</>) : (<>Continue<ArrowRight size={16} /></>)}
        </button>
        {last && (
          <button onClick={finish} style={{
            width: "100%", marginTop: 10, padding: "8px 0", background: "none", border: "none",
            color: T.dim, fontSize: 13, fontFamily: "'Inter',sans-serif", cursor: "pointer",
          }}>Skip for now</button>
        )}
      </div>
    </div>
  );
};

/* ---------- instagram-style profile ---------- */
const ProfileTile = ({ tile }) => {
  const col = T[tile.c] || tile.c;
  return (
  <div style={{
    aspectRatio: "1", borderRadius: 4, overflow: "hidden", position: "relative",
    background: `linear-gradient(150deg, ${col}22, ${T.ink2} 70%)`,
    border: `1px solid ${T.line}`, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", padding: 10, textAlign: "center", gap: 6,
  }}>
    {tile.k === "stat" && (<>
      <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 24, color: col }}>{tile.v}</span>
      <span style={{ fontSize: 9.5, color: T.dim, fontFamily: "'Inter',sans-serif", letterSpacing: "0.06em", lineHeight: 1.3 }}>{tile.l.toUpperCase()}</span>
    </>)}
    {tile.k === "quote" && (<>
      <Quote size={13} color={col} style={{ opacity: 0.7 }} />
      <span style={{ fontSize: 11, color: T.cream, fontFamily: "'Inter',sans-serif", fontWeight: 500, lineHeight: 1.4 }}>{tile.v}</span>
    </>)}
    {tile.k === "icon" && (() => { const Ico = tile.icon; return (<>
      <Ico size={22} color={col} strokeWidth={1.8} />
      <span style={{ fontSize: 9.5, color: T.dim, fontFamily: "'Inter',sans-serif", letterSpacing: "0.04em", lineHeight: 1.3 }}>{tile.l.toUpperCase()}</span>
    </>); })()}
  </div>
  );
};

const UserProfile = ({ user, onBack, member, openMessages, openNotifs, openChat }) => {
  const [following, setFollowing] = useState(false);
  const [gridTab, setGridTab] = useState("grid");
  const [showMenu, setShowMenu] = useState(false);
  const [toast, setToast] = useState(null);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const ex = PROFILE_EXTRAS[user.id] || {};
  const { score, shared } = calcMatch(user, member);
  const LINK_ICONS = { linkedin: Linkedin, instagram: Instagram, x: Twitter, website: Globe };

  const act = (label, fn) => { fn && fn(); setShowMenu(false); setToast(label); setTimeout(() => setToast(null), 1800); };

  const menuItems = user.me
    ? [
        { icon: AgentMark, label: "Refresh AI briefing", fn: () => {} },
        { icon: Bookmark, label: "Saved posts", fn: () => {} },
        { icon: QrCode, label: "My QR code", fn: () => {} },
        { icon: Globe, label: "Copy profile link", fn: () => {} },
        { icon: LogOut, label: "Log out", fn: () => {}, danger: true },
      ]
    : [
        { icon: Share2, label: "Share profile", fn: () => {}, done: "Link copied" },
        { icon: Globe, label: "Copy profile link", fn: () => {}, done: "Link copied" },
        { icon: Bookmark, label: "Save to my list", fn: () => {}, done: "Saved" },
        { icon: muted ? Bell : MicOff, label: muted ? "Unmute" : "Mute posts", fn: () => setMuted(m => !m), done: muted ? "Unmuted" : "Muted" },
        { icon: blocked ? Check : X, label: blocked ? "Unblock" : "Block", fn: () => setBlocked(b => !b), done: blocked ? "Unblocked" : "Blocked", danger: !blocked },
        { icon: Hand, label: "Report", fn: () => {}, done: "Reported to FFG", danger: true },
      ];
  return (
    <div style={{ position: "absolute", inset: 0, background: T.ink, zIndex: 30, display: "flex", flexDirection: "column" }}>
      {/* top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 14px 12px", borderBottom: `1px solid ${T.line}`,
        background: `${T.ink}F0`, backdropFilter: "blur(12px)",
      }}>
        {onBack
          ? <ChevronLeft size={24} color={T.cream} style={{ cursor: "pointer" }} onClick={onBack} />
          : <span style={{ width: 24 }} />}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: T.cream }}>{user.handle}</span>
          {user.verified && <BadgeCheck size={15} color={T.gold} />}
        </div>
        <MoreHorizontal size={22} color={T.cream} style={{ cursor: "pointer" }} onClick={() => setShowMenu(true)} />
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "20px 18px 14px" }}>
          <div style={{
            padding: 3, borderRadius: "50%",
            background: `linear-gradient(135deg, ${T.gold}, ${T.goldSoft}, ${T[PILLAR[user.pillar].k]})`,
          }}>
            <div style={{ padding: 3, borderRadius: "50%", background: T.ink }}>
              <Avatar initials={user.id} size={78} ring="transparent" />
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "space-around" }}>
            {[[user.posts, "Posts"], [user.followers, "Followers"], [user.following, "Following"]].map(([v, l]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 18, color: T.cream }}>{v}</div>
                <div style={{ fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* bio */}
        <div style={{ padding: "0 18px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: T.cream }}>{user.name}</span>
            <PillarTag name={user.pillar} />
          </div>
          <div style={{ fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif", margin: "4px 0 2px" }}>{user.role}</div>
          {ex.lastPost && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.community, fontFamily: "'Inter',sans-serif", margin: "3px 0 8px" }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: T.community }} />Last posted {ex.lastPost}
            </div>
          )}
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: T.cream, fontFamily: "'Inter',sans-serif" }}>{user.bio}</p>

          {/* links */}
          {ex.links && (
            <div style={{ display: "flex", gap: 9, marginTop: 11 }}>
              {Object.keys(ex.links).map(k => {
                const Ico = LINK_ICONS[k];
                return (
                  <div key={k} style={{
                    width: 34, height: 34, borderRadius: 10, cursor: "pointer",
                    background: T.card, border: `1px solid ${T.gold}45`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}><Ico size={15} color={T.gold} /></div>
                );
              })}
            </div>
          )}
        </div>

        {/* actions */}
        <div style={{ display: "flex", gap: 8, padding: "0 18px 14px" }}>
          {user.me ? (<>
            <button style={btnGhost()}>Edit profile</button>
            <button style={btnGhost()}>Share profile</button>
          </>) : (<>
            <button onClick={() => setFollowing(f => !f)} style={{
              ...btnGhost(),
              background: following ? "transparent" : T.gold,
              border: following ? `1px solid ${T.line}` : "none",
              color: following ? T.cream : T.ink, fontWeight: 700,
            }}>{following ? "Following" : "Follow"}</button>
            <button style={btnGhost()} onClick={() => openChat && openChat(user.id)}>Message</button>
            <button style={{ ...btnGhost(), flex: 0, padding: "10px 13px" }}><Handshake size={16} /></button>
          </>)}
        </div>

        {/* inbox + notifications (own profile) */}
        {user.me && openMessages && (
          <div style={{ display: "flex", gap: 10, padding: "0 18px 18px" }}>
            <div onClick={openMessages} style={{
              flex: 1, borderRadius: 16, padding: "14px 15px", cursor: "pointer",
              background: T.card, border: `1px solid ${T.line}`,
              display: "flex", alignItems: "center", gap: 11,
            }}>
              <div style={{ position: "relative" }}>
                <MessageCircle size={21} color={T.gold} />
                <span style={{
                  position: "absolute", top: -5, right: -7, minWidth: 16, height: 16, borderRadius: 8,
                  background: T.gold, color: T.ink, fontSize: 10, fontWeight: 800, padding: "0 4px",
                  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif",
                }}>{THREADS.reduce((s, t) => s + t.unread, 0)}</span>
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.cream, fontFamily: "'Inter',sans-serif" }}>Messages</div>
                <div style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{THREADS.filter(t => t.unread).length} unread chats</div>
              </div>
            </div>
            <div onClick={openNotifs} style={{
              flex: 1, borderRadius: 16, padding: "14px 15px", cursor: "pointer",
              background: T.card, border: `1px solid ${T.line}`,
              display: "flex", alignItems: "center", gap: 11,
            }}>
              <div style={{ position: "relative" }}>
                <Bell size={21} color={T.gold} />
                <span style={{
                  position: "absolute", top: -5, right: -7, minWidth: 16, height: 16, borderRadius: 8,
                  background: T.gold, color: T.ink, fontSize: 10, fontWeight: 800, padding: "0 4px",
                  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif",
                }}>{NOTIFS.filter(n => n.unread).length}</span>
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.cream, fontFamily: "'Inter',sans-serif" }}>Notifications</div>
                <div style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{NOTIFS.filter(n => n.unread).length} new</div>
              </div>
            </div>
          </div>
        )}

        {/* match card */}
        {!user.me && (
          <div style={{
            margin: "0 18px 18px", borderRadius: 18, padding: "16px 17px",
            background: `linear-gradient(130deg, ${T.gold}20, ${T.ink2} 70%)`,
            border: `1px solid ${T.gold}45`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 34, color: T.gold, lineHeight: 1 }}>{score}<span style={{ fontSize: 17 }}>%</span></div>
                <div style={{ fontSize: 9, letterSpacing: "0.14em", color: T.dim, fontFamily: "'Inter',sans-serif", marginTop: 3 }}>MATCH</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <AgentMark size={13} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.goldSoft, fontFamily: "'Inter',sans-serif" }}>Why you two should connect</span>
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: T.cream, fontFamily: "'Inter',sans-serif" }}>
                  {shared.length > 0
                    ? <>You share {shared.length} interest{shared.length > 1 ? "s" : ""} — {shared.slice(0, 3).join(", ").toLowerCase()} — and {user.name.split(" ")[0]} is active in your pillar.</>
                    : <>{user.name.split(" ")[0]}'s focus complements your goals — strong overlap in ambition and stage.</>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* working on */}
        {ex.workingOn && (
          <div style={{ padding: "0 18px 16px" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 7 }}>CURRENTLY WORKING ON</div>
            <div style={{
              fontSize: 13.5, lineHeight: 1.55, color: T.cream, fontFamily: "'Inter',sans-serif",
              background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "13px 15px",
              display: "flex", gap: 10,
            }}>
              <Zap size={15} color={T.gold} style={{ flexShrink: 0, marginTop: 2 }} />
              {ex.workingOn}
            </div>
          </div>
        )}

        {/* interests */}
        {ex.interests && (
          <div style={{ padding: "0 18px 16px" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 9 }}>INTERESTS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {ex.interests.map(i => {
                const isShared = shared.includes(i);
                return (
                  <span key={i} style={{
                    fontSize: 12, fontWeight: 600, fontFamily: "'Inter',sans-serif",
                    padding: "6px 13px", borderRadius: 999,
                    background: isShared ? `${T.gold}22` : T.card,
                    border: `1px solid ${isShared ? T.gold : T.line}`,
                    color: isShared ? T.goldSoft : T.cream,
                    display: "inline-flex", alignItems: "center", gap: 5,
                  }}>{isShared && <Check size={11} strokeWidth={3} />}{i}</span>
                );
              })}
            </div>
            {shared.length > 0 && (
              <div style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif", marginTop: 7 }}>Gold = interests you share</div>
            )}
          </div>
        )}

        {/* posts about */}
        {ex.contentTypes && (
          <div style={{ padding: "0 18px 18px" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 9 }}>POSTS ABOUT</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {ex.contentTypes.map(c => (
                <span key={c} style={{
                  fontSize: 12, fontFamily: "'Inter',sans-serif", fontWeight: 500,
                  padding: "6px 13px", borderRadius: 8,
                  background: `${T.connect}14`, border: `1px solid ${T.connect}35`, color: T.connect,
                }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* highlights */}
        <div style={{ display: "flex", gap: 18, padding: "0 18px 18px", overflowX: "auto" }}>
          {user.highlights.map(h => {
            const Ico = h.icon;
            return (
              <div key={h.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div style={{
                  width: 58, height: 58, borderRadius: "50%", background: T.card,
                  border: `1.5px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center",
                }}><Ico size={21} color={T.goldSoft} strokeWidth={1.8} /></div>
                <span style={{ fontSize: 11, color: T.cream, fontFamily: "'Inter',sans-serif" }}>{h.label}</span>
              </div>
            );
          })}
        </div>

        {/* grid tabs */}
        <div style={{ display: "flex", borderTop: `1px solid ${T.line}` }}>
          {[["grid", Grid3x3], ["tagged", Users]].map(([id, Ico]) => (
            <div key={id} onClick={() => setGridTab(id)} style={{
              flex: 1, display: "flex", justifyContent: "center", padding: "12px 0", cursor: "pointer",
              borderBottom: gridTab === id ? `2px solid ${T.gold}` : "2px solid transparent",
            }}><Ico size={20} color={gridTab === id ? T.gold : T.dim} /></div>
          ))}
        </div>

        {/* grid */}
        {gridTab === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, padding: 2 }}>
            {user.tiles.map((t, i) => <ProfileTile key={i} tile={t} />)}
          </div>
        ) : (
          <div style={{ padding: "44px 18px", textAlign: "center" }}>
            <Users size={30} color={T.dim} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 13.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>Posts featuring {user.name.split(" ")[0]} appear here.</div>
          </div>
        )}
        <div style={{ height: 90 }} />
      </div>

      {/* action menu */}
      {showMenu && (
        <div style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setShowMenu(false)} style={{ position: "absolute", inset: 0, background: "#00000080", backdropFilter: "blur(3px)" }} />
          <div style={{
            position: "relative", background: T.ink2, borderRadius: "22px 22px 0 0",
            border: `1px solid ${T.line}`, borderBottom: "none",
            padding: "8px 0 calc(12px + env(safe-area-inset-bottom))",
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: T.line, margin: "8px auto 12px" }} />
            <div style={{ padding: "0 16px 8px", fontFamily: "'Inter',sans-serif", fontSize: 13, color: T.dim, textAlign: "center" }}>
              {user.me ? "Account" : `@${user.handle}`}
            </div>
            {menuItems.map(item => {
              const Ico = item.icon;
              return (
                <div key={item.label} onClick={() => act(item.done || item.label, item.fn)} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 22px", cursor: "pointer",
                  borderTop: `1px solid ${T.line}`,
                }}>
                  <Ico size={18} color={item.danger ? T.community : T.cream} />
                  <span style={{
                    fontSize: 14.5, fontFamily: "'Inter',sans-serif", fontWeight: 500,
                    color: item.danger ? T.community : T.cream,
                  }}>{item.label}</span>
                </div>
              );
            })}
            <div onClick={() => setShowMenu(false)} style={{
              margin: "12px 16px 0", padding: "13px 0", borderRadius: 999,
              background: T.card, border: `1px solid ${T.line}`, textAlign: "center", cursor: "pointer",
              fontSize: 14, fontFamily: "'Inter',sans-serif", fontWeight: 600, color: T.cream,
            }}>Cancel</div>
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div style={{
          position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
          background: T.card, border: `1px solid ${T.gold}45`,
          padding: "11px 18px", borderRadius: 999, zIndex: 70,
          fontSize: 13, fontFamily: "'Inter',sans-serif", fontWeight: 600, color: T.cream,
          display: "flex", alignItems: "center", gap: 7,
          animation: "ffgStepIn 0.3s cubic-bezier(.2,.8,.2,1)",
          boxShadow: "0 6px 24px #00000060",
        }}>
          <Check size={14} color={T.gold} />{toast}
        </div>
      )}
    </div>
  );
};

const btnGhost = () => ({
  flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${T.line}`,
  background: T.card, color: T.cream, fontFamily: "'Inter',sans-serif",
  fontWeight: 600, fontSize: 13.5, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
});

/* ---------- AI concierge ---------- */
const CONCIERGE_CONTEXT = `You are the Connect Concierge — the AI assistant inside the Forbes Family Group member app.

About Forbes Family Group (FFG): a UK organisation opening doors for people from underserved communities across three pillars — Capital, Community and Connect. 10,000+ people supported, 750K+ digital community, £1M+ raised for causes, 16 founders backed, 150+ events hosted. Motto: "From access to ownership."

FFG Digital is the new venture arm: it advises and power-teaches early-stage businesses, packages funding with hands-on technology support, and takes a minority stake in startups it powers (Advise · Power · Own). Cohort One applications are open.

Upcoming events: Founders' Breakfast (Shoreditch, 31 Jul, 8 seats left), Pitch Practice Night (FFG HQ, 6 Aug), AI for Founders Lab (online, 12 Aug).

Your job: answer member questions warmly and concisely (2-4 short sentences), help them find mentors, events, funding routes and programmes, and take messages for the FFG team. If someone wants to contact the group directly, confirm you've logged their message for the team and they'll hear back within one working day. Never invent contact details. Match the tone of a premium members' club: warm, direct, no fluff.`;

const QUICK_PROMPTS = [
  "How do I join FFG Digital?",
  "Find me a mentor",
  "What events are coming up?",
  "Send a message to the team",
];

const Concierge = ({ onClose }) => {
  const [msgs, setMsgs] = useState([
    { role: "assistant", content: "Welcome to FFG. I'm your concierge — I can help you find mentors, events and funding, or pass a message straight to the team. What do you need?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = React.useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, busy]);

  const ask = async (text) => {
    if (!text.trim() || busy) return;
    const next = [...msgs, { role: "user", content: text.trim() }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [
            { role: "user", content: CONCIERGE_CONTEXT + "\n\nConversation so far:\n" +
              next.map(m => (m.role === "user" ? "Member: " : "Concierge: ") + m.content).join("\n") +
              "\n\nReply as the Concierge only — no preamble, no labels." },
          ],
        }),
      });
      const data = await response.json();
      const reply = (data.content || [])
        .filter(b => b.type === "text")
        .map(b => b.text)
        .join("\n")
        .trim();
      setMsgs(m => [...m, { role: "assistant", content: reply || "I've logged that for the team — you'll hear back within one working day." }]);
    } catch (e) {
      setMsgs(m => [...m, { role: "assistant", content: "I couldn't reach the network just now, but I've saved your message locally — try me again in a moment." }]);
    }
    setBusy(false);
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 45, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "#00000090", backdropFilter: "blur(3px)" }} />
      <div style={{
        position: "relative", background: T.ink2, borderRadius: "22px 22px 0 0",
        border: `1px solid ${T.line}`, borderBottom: "none", height: "78%",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* sheet header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: `1px solid ${T.line}` }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
            background: `linear-gradient(135deg, ${T.gold}30, ${T.ink})`,
            border: `1px solid ${T.gold}60`, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <img src={T.logo} alt="" style={{ width: 20, height: 20 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 15, color: T.cream }}>Connect Concierge</span>
              <AgentMark size={13} />
            </div>
            <span style={{ fontSize: 11.5, color: T.community, fontFamily: "'Inter',sans-serif" }}>● Online — direct line to the group</span>
          </div>
          <X size={22} color={T.dim} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>

        {/* messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "82%", padding: "11px 14px", fontSize: 14, lineHeight: 1.5,
              fontFamily: "'Inter',sans-serif", color: m.role === "user" ? T.ink : T.cream,
              background: m.role === "user" ? `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})` : T.card,
              border: m.role === "user" ? "none" : `1px solid ${T.line}`,
              borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              whiteSpace: "pre-wrap",
            }}>{m.content}</div>
          ))}
          {busy && (
            <div style={{
              alignSelf: "flex-start", padding: "11px 16px", background: T.card,
              border: `1px solid ${T.line}`, borderRadius: "16px 16px 16px 4px",
              color: T.dim, fontSize: 13, fontFamily: "'Inter',sans-serif",
            }}>Thinking…</div>
          )}
        </div>

        {/* quick prompts */}
        {msgs.length <= 1 && (
          <div style={{ display: "flex", gap: 8, padding: "6px 16px 10px", overflowX: "auto" }}>
            {QUICK_PROMPTS.map(q => (
              <button key={q} onClick={() => ask(q)} style={{
                flexShrink: 0, padding: "8px 14px", borderRadius: 999, cursor: "pointer",
                background: "transparent", border: `1px solid ${T.gold}50`,
                color: T.goldSoft, fontSize: 12.5, fontFamily: "'Inter',sans-serif", fontWeight: 500,
              }}>{q}</button>
            ))}
          </div>
        )}

        {/* input */}
        <div style={{ display: "flex", gap: 10, padding: "10px 14px calc(14px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.line}`, background: T.ink }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") ask(input); }}
            placeholder="Message the group…"
            style={{
              flex: 1, padding: "13px 16px", borderRadius: 999, outline: "none",
              background: T.card, border: `1px solid ${T.line}`, color: T.cream,
              fontSize: 14, fontFamily: "'Inter',sans-serif",
            }}
          />
          <button onClick={() => ask(input)} disabled={busy} style={{
            width: 46, height: 46, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
            background: `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})`,
            display: "flex", alignItems: "center", justifyContent: "center", opacity: busy ? 0.5 : 1,
          }}><Send size={18} color={T.ink} /></button>
        </div>
      </div>
    </div>
  );
};

/* ---------- articles ---------- */
const ArticleReader = ({ article, onBack, openUser }) => {
  const author = USERS[article.author];
  return (
    <div style={{ position: "absolute", inset: 0, background: T.ink, zIndex: 30, display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 14px 12px", borderBottom: `1px solid ${T.line}`,
        background: `${T.ink}F0`, backdropFilter: "blur(12px)",
      }}>
        <ChevronLeft size={24} color={T.cream} style={{ cursor: "pointer" }} onClick={onBack} />
        <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: T.cream }}>Article</span>
        <Bookmark size={20} color={T.cream} />
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {article.image && (
          <img src={EVENT_PICS[article.image]} alt="" style={{ width: "100%", display: "block" }} />
        )}
        <div style={{ padding: "20px 20px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <PillarTag name={article.tag} />
            <span style={{ fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{article.read} read · {article.time}</span>
          </div>
          <h1 style={{ margin: "0 0 16px", fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 25, lineHeight: 1.2, color: T.cream }}>{article.title}</h1>
          {author && (
            <div onClick={() => openUser(author.id)} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer" }}>
              <Avatar initials={author.id} size={38} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13.5, color: T.cream }}>{author.name}</span>
                  {author.verified && <BadgeCheck size={13} color={T.gold} />}
                </div>
                <span style={{ fontSize: 11.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{author.role}</span>
              </div>
            </div>
          )}
          {article.ai && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 20,
              background: `${T.gold}14`, border: `1px solid ${T.gold}40`, borderRadius: 12, padding: "10px 13px",
            }}>
              <AgentMark size={14} />
              <span style={{ fontSize: 12, color: T.goldSoft, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>Written live by FFG AI, just for you</span>
            </div>
          )}
          {article.body.map((para, i) => (
            <p key={i} style={{
              margin: "0 0 18px", fontSize: 15, lineHeight: 1.75, color: T.cream,
              fontFamily: "'Inter',sans-serif",
              ...(i === 0 ? { fontSize: 16, fontWeight: 500 } : {}),
            }}>{para}</p>
          ))}
        </div>
        <div style={{ padding: "0 20px 30px" }}>
          <LikeRow likes={article.ai ? 0 : 120 + article.title.length} comments={article.ai ? 0 : 18} />
        </div>
        <div style={{ height: 80 }} />
      </div>
    </div>
  );
};

/**
 * Library.
 *
 * Read-only for members. Articles are editorial and are published by the
 * FFG team through the admin API — members can no longer generate or write
 * pieces into the Library. The API enforces this (admin-only POST); this
 * screen simply has no compose surface.
 */
const Articles = ({ openArticle, openUser, member }) => {
  return (
    <div>
      <SectionTitle eyebrow="IDEAS FROM THE COMMUNITY" title="Library" />

      {/* featured article */}
      <div onClick={() => openArticle(ARTICLES[0])} style={{
        margin: "0 18px 14px", borderRadius: 20, overflow: "hidden", cursor: "pointer",
        border: `1px solid ${T.line}`, background: T.card,
      }}>
        <img src={EVENT_PICS[ARTICLES[0].image]} alt="" style={{ width: "100%", display: "block" }} />
        <div style={{ padding: "15px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <PillarTag name={ARTICLES[0].tag} />
            <span style={{ fontSize: 11.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{ARTICLES[0].read} · {ARTICLES[0].time}</span>
          </div>
          <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 19, lineHeight: 1.25, color: T.cream, marginBottom: 6 }}>{ARTICLES[0].title}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{ARTICLES[0].excerpt}</div>
        </div>
      </div>

      {/* article list */}
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {ARTICLES.slice(1).map(a => {
          const author = USERS[a.author];
          return (
            <div key={a.id} onClick={() => openArticle(a)} style={{
              display: "flex", gap: 13, background: T.card, border: `1px solid ${T.line}`,
              borderRadius: 16, padding: 13, cursor: "pointer", alignItems: "center",
            }}>
              <div style={{ width: 86, height: 86, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
                <img src={EVENT_PICS[a.image]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14, lineHeight: 1.35, color: T.cream, marginBottom: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Avatar initials={a.author} size={20} />
                  <span style={{ fontSize: 11.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{author.name.split(" ")[0]} · {a.read} · {a.time}</span>
                </div>
              </div>
              <ChevronRight size={17} color={T.dim} style={{ flexShrink: 0 }} />
            </div>
          );
        })}
      </div>
      <div style={{ height: 90 }} />
    </div>
  );
};


/* ---------- messaging + notifications ---------- */
const THREADS = [
  { uid: "AO", unread: 2, time: "12m", last: "Perfect — I'll intro you to our pilot lead tomorrow 🙌" },
  { uid: "NC", unread: 1, time: "1h", last: "Send me your deck before Friday's clinic and I'll take a pass." },
  { uid: "MJ", unread: 0, time: "3h", last: "Good numbers. Let's talk after Pitch Practice Night." },
  { uid: "FE", unread: 0, time: "1d", last: "Your seat for Founders' Breakfast is confirmed ✔" },
  { uid: "RC", unread: 0, time: "2d", last: "v1 scope looks right. Six weeks is realistic." },
];

const THREAD_HISTORY = {
  AO: [
    { me: false, text: "Saw your post — congrats on the build! How are you finding the cohort?" },
    { me: true, text: "Honestly the best part is the room. Everyone actually answers." },
    { me: false, text: "Right?? Listen — our corporate pilot lead wants to meet more FFG founders." },
    { me: false, text: "Perfect — I'll intro you to our pilot lead tomorrow 🙌" },
  ],
  NC: [
    { me: false, text: "Great questions in the brand room today." },
    { me: true, text: "Thank you! Would love your eyes on our positioning." },
    { me: false, text: "Send me your deck before Friday's clinic and I'll take a pass." },
  ],
  MJ: [
    { me: true, text: "Marcus — sharing our latest traction update. 40% MoM." },
    { me: false, text: "Good numbers. Let's talk after Pitch Practice Night." },
  ],
  FE: [
    { me: false, text: "Your seat for Founders' Breakfast is confirmed ✔" },
  ],
  RC: [
    { me: true, text: "Rafa, could you scope a v1 for our marketplace idea?" },
    { me: false, text: "v1 scope looks right. Six weeks is realistic." },
  ],
};

const CANNED_REPLIES = [
  "Love that — let's make it happen.",
  "On it. Give me a day and I'll come back to you.",
  "That's exactly the right move. Talk soon 👊",
  "Adding it to my list — see you at the next event?",
];

const NOTIFS = [
  { icon: "heart", uid: "AO", text: "Amara liked your post", time: "8m", unread: true },
  { icon: "match", uid: "SF", text: "New match: Simone Frazier — 94% compatibility", time: "22m", unread: true },
  { icon: "follow", uid: "DJ", text: "Deji Adeyemi started following you", time: "1h", unread: true },
  { icon: "room", uid: "MJ", text: "Marcus is live: Fundraising in 2026", time: "2h", unread: true },
  { icon: "event", uid: "FE", text: "Founders' Breakfast is in 7 days — 8 seats left", time: "5h", unread: true },
  { icon: "heart", uid: "KB", text: "Kwame and 12 others liked your comment", time: "1d", unread: false },
  { icon: "follow", uid: "LH", text: "Leila Haddad started following you", time: "1d", unread: false },
  { icon: "event", uid: "FF", text: "FFG Digital cohort applications open Monday", time: "2d", unread: false },
];

const NOTIF_ICONS = { heart: Heart, match: AgentMark, follow: User, room: Radio, event: Calendar };
const NOTIF_COLORS = { heart: "community", match: "gold", follow: "connect", room: "gold", event: "community" };

const overlayTopBar = (title, onBack, right = null) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 14px 12px", borderBottom: `1px solid ${T.line}`,
    background: `${T.ink}F0`, backdropFilter: "blur(12px)",
  }}>
    <ChevronLeft size={24} color={T.cream} style={{ cursor: "pointer" }} onClick={onBack} />
    <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: T.cream }}>{title}</span>
    {right || <span style={{ width: 24 }} />}
  </div>
);

const ChatView = ({ uid, onBack, openUser }) => {
  const u = USERS[uid];
  const [msgs, setMsgs] = useState(THREAD_HISTORY[uid] || []);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = React.useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, typing]);
  const send = () => {
    if (!input.trim()) return;
    setMsgs(m => [...m, { me: true, text: input.trim() }]);
    setInput("");
    setTimeout(() => setTyping(true), 700);
    setTimeout(() => {
      setTyping(false);
      setMsgs(m => [...m, { me: false, text: CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)] }]);
    }, 2300);
  };
  return (
    <div style={{ position: "absolute", inset: 0, background: T.ink, zIndex: 36, display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 11,
        padding: "12px 14px", borderBottom: `1px solid ${T.line}`,
        background: `${T.ink}F0`, backdropFilter: "blur(12px)",
      }}>
        <ChevronLeft size={24} color={T.cream} style={{ cursor: "pointer" }} onClick={onBack} />
        <Avatar initials={uid} size={38} onClick={() => openUser(uid)} />
        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => openUser(uid)}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14.5, color: T.cream }}>{u.name}</span>
            {u.verified && <BadgeCheck size={14} color={T.gold} />}
          </div>
          <span style={{ fontSize: 11.5, color: T.community, fontFamily: "'Inter',sans-serif" }}>● Active now</span>
        </div>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 9 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.me ? "flex-end" : "flex-start",
            maxWidth: "80%", padding: "10px 14px", fontSize: 14, lineHeight: 1.5,
            fontFamily: "'Inter',sans-serif",
            color: m.me ? T.ink : T.cream,
            background: m.me ? `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})` : T.card,
            border: m.me ? "none" : `1px solid ${T.line}`,
            borderRadius: m.me ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          }}>{m.text}</div>
        ))}
        {typing && (
          <div style={{
            alignSelf: "flex-start", padding: "12px 16px", background: T.card,
            border: `1px solid ${T.line}`, borderRadius: "16px 16px 16px 4px",
            color: T.dim, fontSize: 13, fontFamily: "'Inter',sans-serif",
          }}>typing…</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, padding: "10px 14px calc(14px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.line}`, background: T.ink }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send(); }}
          placeholder={`Message ${u.name.split(" ")[0]}…`}
          style={{
            flex: 1, padding: "13px 16px", borderRadius: 999, outline: "none",
            background: T.card, border: `1px solid ${T.line}`, color: T.cream,
            fontSize: 14, fontFamily: "'Inter',sans-serif",
          }} />
        <button onClick={send} style={{
          width: 46, height: 46, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
          background: `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><Send size={18} color={T.ink} /></button>
      </div>
    </div>
  );
};

const MessagesScreen = ({ onBack, openChat, openUser }) => (
  <div style={{ position: "absolute", inset: 0, background: T.ink, zIndex: 35, display: "flex", flexDirection: "column" }}>
    {overlayTopBar("Messages", onBack)}
    <div style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
      {THREADS.map(t => {
        const u = USERS[t.uid];
        return (
          <div key={t.uid} onClick={() => openChat(t.uid)} style={{
            display: "flex", alignItems: "center", gap: 13, padding: "13px 18px", cursor: "pointer",
            borderBottom: `1px solid ${T.line}`,
          }}>
            <Avatar initials={t.uid} size={50} ring={t.unread ? T.gold : T.line} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: t.unread ? 800 : 600, fontSize: 14.5, color: T.cream }}>{u.name}</span>
                {u.verified && <BadgeCheck size={13} color={T.gold} />}
              </div>
              <div style={{
                fontSize: 12.5, color: t.unread ? T.cream : T.dim, fontFamily: "'Inter',sans-serif",
                fontWeight: t.unread ? 600 : 400,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{t.last}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{t.time}</span>
              {t.unread > 0 && (
                <span style={{
                  minWidth: 19, height: 19, borderRadius: 10, padding: "0 6px",
                  background: T.gold, color: T.ink, fontSize: 11, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif",
                }}>{t.unread}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

/* ---------- search ---------- */
/**
 * One pass over everything the app already holds in memory: members, posts,
 * events, rooms and reads. Matching is a plain case-insensitive substring over
 * each record's own text plus, where it helps, the author's name — so
 * searching "Kemi" finds her posts as well as her profile.
 */
const runSearch = q => {
  const s = q.trim().toLowerCase();
  if (!s) return null;
  const hit = (...vals) => vals.filter(Boolean).join(" ").toLowerCase().includes(s);
  return {
    members: Object.values(USERS).filter(u => hit(u.name, u.handle, u.role, u.bio, u.pillar)),
    posts: POSTS.filter(p => hit(p.text, p.pillar, USERS[p.uid]?.name)),
    events: EVENTS.filter(e => hit(e.name, e.where, e.tag, e.about)),
    rooms: ROOMS.filter(r => hit(r.title, r.tag, r.desc, r.when)),
    reads: ARTICLES.filter(a => hit(a.title, a.excerpt, a.tag, USERS[a.author]?.name, ...(a.body || []))),
  };
};

const SearchGroup = ({ label, children }) => (
  <>
    <div style={{
      fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 700,
      fontFamily: "'Inter',sans-serif", padding: "16px 18px 8px",
    }}>{label}</div>
    {children}
  </>
);

const SearchRow = ({ icon, title, sub, onClick }) => (
  <div onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: 13, padding: "11px 18px", cursor: "pointer",
  }}>
    {icon}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14, color: T.cream,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{title}</div>
      {sub && (
        <div style={{
          fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif", marginTop: 2,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{sub}</div>
      )}
    </div>
    <ChevronRight size={17} color={T.dim} style={{ flexShrink: 0 }} />
  </div>
);

const SearchIconBadge = ({ children }) => (
  <div style={{
    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
    background: T.card, border: `1px solid ${T.line}`,
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>{children}</div>
);

const SearchScreen = ({ onBack, openUser, openRoom, openEvent, openArticle }) => {
  const [q, setQ] = useState("");
  const inputRef = React.useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const res = runSearch(q);
  const total = res
    ? res.members.length + res.posts.length + res.events.length + res.rooms.length + res.reads.length
    : 0;

  return (
    <div style={{ position: "absolute", inset: 0, background: T.ink, zIndex: 37, display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 14px", borderBottom: `1px solid ${T.line}`,
        background: `${T.ink}F0`, backdropFilter: "blur(12px)",
      }}>
        <ChevronLeft size={24} color={T.cream} style={{ cursor: "pointer", flexShrink: 0 }} onClick={onBack} />
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 9,
          background: T.card, border: `1px solid ${T.line}`, borderRadius: 999, padding: "9px 14px",
        }}>
          <Search size={17} color={T.dim} style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search members, events, rooms, library…"
            style={{
              flex: 1, minWidth: 0, background: "none", border: "none", outline: "none",
              color: T.cream, fontSize: 14, fontFamily: "'Inter',sans-serif",
            }}
          />
          {q && (
            <X size={16} color={T.dim} style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => { setQ(""); inputRef.current?.focus(); }} />
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24 }}>
        {!res && (
          <div style={{ padding: "48px 32px", textAlign: "center" }}>
            <Search size={30} color={T.dim} />
            <div style={{ marginTop: 14, fontSize: 14, color: T.dim, fontFamily: "'Inter',sans-serif", lineHeight: 1.55 }}>
              Search across members, posts, events, rooms and library.
            </div>
          </div>
        )}

        {res && total === 0 && (
          <div style={{ padding: "48px 32px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 18, color: T.cream }}>
              No results for “{q.trim()}”
            </div>
            <div style={{ marginTop: 8, fontSize: 13.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
              Try a name, a pillar like Capital, or an event.
            </div>
          </div>
        )}

        {res && res.members.length > 0 && (
          <SearchGroup label="MEMBERS">
            {res.members.map(u => (
              <SearchRow
                key={u.id}
                icon={<Avatar initials={u.id} size={40} />}
                title={u.name}
                sub={u.role}
                onClick={() => openUser(u.id)}
              />
            ))}
          </SearchGroup>
        )}

        {res && res.rooms.length > 0 && (
          <SearchGroup label="ROOMS">
            {res.rooms.map(r => (
              <SearchRow
                key={r.id}
                icon={<SearchIconBadge><Radio size={18} color={r.live ? T.gold : T.dim} /></SearchIconBadge>}
                title={r.title}
                sub={r.live ? `● Live · ${r.listeners} listening` : r.when}
                onClick={() => openRoom(r.id)}
              />
            ))}
          </SearchGroup>
        )}

        {res && res.events.length > 0 && (
          <SearchGroup label="EVENTS">
            {res.events.map(e => (
              <SearchRow
                key={e.id}
                icon={<SearchIconBadge><Calendar size={18} color={T.gold} /></SearchIconBadge>}
                title={e.name}
                sub={`${e.date} ${e.month} · ${e.where}`}
                onClick={() => openEvent(e.id)}
              />
            ))}
          </SearchGroup>
        )}

        {res && res.reads.length > 0 && (
          <SearchGroup label="LIBRARY">
            {res.reads.map(a => (
              <SearchRow
                key={a.id}
                icon={<SearchIconBadge><BookOpen size={18} color={T.gold} /></SearchIconBadge>}
                title={a.title}
                sub={`${USERS[a.author]?.name || ""} · ${a.read}`}
                onClick={() => openArticle(a)}
              />
            ))}
          </SearchGroup>
        )}

        {res && res.posts.length > 0 && (
          <SearchGroup label="POSTS">
            {res.posts.map((p, i) => (
              <SearchRow
                key={i}
                icon={<Avatar initials={p.uid} size={40} />}
                title={USERS[p.uid]?.name || p.uid}
                sub={p.text}
                onClick={() => openUser(p.uid)}
              />
            ))}
          </SearchGroup>
        )}
      </div>
    </div>
  );
};

const NotificationsScreen = ({ onBack, openUser }) => (
  <div style={{ position: "absolute", inset: 0, background: T.ink, zIndex: 35, display: "flex", flexDirection: "column" }}>
    {overlayTopBar("Notifications", onBack)}
    <div style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 700, fontFamily: "'Inter',sans-serif", padding: "8px 18px 10px" }}>NEW</div>
      {NOTIFS.filter(n => n.unread).map((n, i) => <NotifRow key={i} n={n} openUser={openUser} />)}
      <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.dim, fontWeight: 700, fontFamily: "'Inter',sans-serif", padding: "18px 18px 10px" }}>EARLIER</div>
      {NOTIFS.filter(n => !n.unread).map((n, i) => <NotifRow key={i} n={n} openUser={openUser} />)}
    </div>
  </div>
);

const NotifRow = ({ n, openUser }) => {
  const Ico = NOTIF_ICONS[n.icon];
  const col = T[NOTIF_COLORS[n.icon]];
  return (
    <div onClick={() => openUser(n.uid)} style={{
      display: "flex", alignItems: "center", gap: 13, padding: "12px 18px", cursor: "pointer",
      background: n.unread ? `${T.gold}0A` : "transparent",
    }}>
      <div style={{ position: "relative" }}>
        <Avatar initials={n.uid} size={46} />
        <div style={{
          position: "absolute", bottom: -3, right: -3, width: 20, height: 20, borderRadius: 10,
          background: col, border: `2px solid ${T.ink}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><Ico size={10} color={T.ink} strokeWidth={2.6} /></div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, color: T.cream, fontFamily: "'Inter',sans-serif", fontWeight: n.unread ? 600 : 400, lineHeight: 1.4 }}>{n.text}</div>
        <div style={{ fontSize: 11.5, color: T.dim, fontFamily: "'Inter',sans-serif", marginTop: 2 }}>{n.time} ago</div>
      </div>
      {n.unread && <span style={{ width: 8, height: 8, borderRadius: 4, background: T.gold, flexShrink: 0 }} />}
    </div>
  );
};

/* ---------- shell chrome ---------- */
const Header = ({ onBell, onSearch }) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 18px 12px", position: "sticky", top: 0, zIndex: 10,
    background: `${T.ink}F0`, backdropFilter: "blur(12px)", borderBottom: `1px solid ${T.line}`,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <img src={T.logo} alt="" style={{ width: 26, height: 26 }} />
      <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 15, color: T.cream, letterSpacing: "0.04em" }}>Connect</span>
    </div>
    <div style={{ display: "flex", gap: 18, color: T.cream, alignItems: "center" }}>
      <span onClick={onSearch} style={{ cursor: "pointer", display: "flex" }}>
        <Search size={21} strokeWidth={2} />
      </span>
      <div style={{ position: "relative", cursor: "pointer" }} onClick={onBell}>
        <Bell size={21} strokeWidth={2} />
        <span style={{ position: "absolute", top: -1, right: -1, width: 8, height: 8, borderRadius: 4, background: T.gold }} />
      </div>
    </div>
  </div>
);

/* ---------- screens ---------- */
const AIBriefing = ({ openConcierge, member }) => (
  <div onClick={openConcierge} style={{
    margin: "14px 18px 2px", borderRadius: 18, padding: "15px 16px", cursor: "pointer",
    background: `linear-gradient(130deg, ${T.gold}1C, ${T.ink2} 65%)`,
    border: `1px solid ${T.gold}38`, display: "flex", gap: 12, alignItems: "flex-start",
  }}>
    <AgentMark size={17} style={{ marginTop: 2 }} />
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 5 }}>
        {member?.name ? `${member.name.split(" ")[0].toUpperCase()}, YOUR CONNECT CONCIERGE` : "YOUR CONNECT CONCIERGE"}
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, color: T.cream, fontFamily: "'Inter',sans-serif" }}>
        {member?.reasons?.includes("Find a mentor")
          ? "3 mentor matches picked for you this week, Founders' Breakfast is down to 8 seats, and FFG Digital cohort applications open Monday."
          : "3 new matches this week, Founders' Breakfast is down to 8 seats, and FFG Digital cohort applications open Monday."}
      </div>
    </div>
    <ChevronRight size={17} color={T.dim} style={{ flexShrink: 0, marginTop: 2 }} />
  </div>
);

const LikeRow = ({ likes, comments }) => {
  const [liked, setLiked] = useState(false);
  return (
    <div style={{ display: "flex", gap: 26, color: T.dim, alignItems: "center" }}>
      <span onClick={() => setLiked(l => !l)} style={{
        display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontFamily: "'Inter',sans-serif",
        cursor: "pointer", color: liked ? T.gold : T.dim, fontWeight: liked ? 700 : 400,
        transition: "color 0.15s",
      }}>
        <Heart size={19} strokeWidth={2} fill={liked ? T.gold : "none"}
          style={{ transform: liked ? "scale(1.15)" : "none", transition: "transform 0.2s cubic-bezier(.3,1.6,.5,1)" }} />
        {likes + (liked ? 1 : 0)}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontFamily: "'Inter',sans-serif" }}>
        <MessageCircle size={19} strokeWidth={2} />{comments}</span>
      <Share2 size={18} strokeWidth={2} />
      <Bookmark size={18} strokeWidth={2} style={{ marginLeft: "auto" }} />
    </div>
  );
};

const LiveStrip = ({ openRoom }) => {
  const live = ROOMS.filter(r => r.live);
  return (
    <div style={{ padding: "16px 0 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 18px", marginBottom: 10 }}>
        <span style={{ width: 7, height: 7, borderRadius: 4, background: T.gold, animation: "ffgPulse 1.6s infinite" }} />
        <span style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 700, fontFamily: "'Inter',sans-serif" }}>HAPPENING NOW IN ROOMS</span>
      </div>
      <div style={{ display: "flex", gap: 10, padding: "0 18px", overflowX: "auto" }}>
        {live.map(r => (
          <div key={r.id} onClick={() => openRoom(r.id)} style={{
            flexShrink: 0, width: 230, borderRadius: 16, padding: "13px 14px", cursor: "pointer",
            background: `linear-gradient(140deg, ${T[PILLAR[r.tag].k]}1E, ${T.card} 70%)`,
            border: `1px solid ${T[PILLAR[r.tag].k]}40`,
          }}>
            <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13, color: T.cream, lineHeight: 1.35, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.title}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex" }}>
                {r.speakers.slice(0, 3).map((uid, i) => (
                  <div key={uid} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                    <Avatar initials={uid} size={26} ring={T.card} />
                  </div>
                ))}
              </div>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: T.gold, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>
                <Radio size={12} />{r.listeners}
              </span>
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes ffgPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }`}</style>
    </div>
  );
};

const SuggestedStrip = ({ openUser }) => {
  const [followed, setFollowed] = useState({});
  return (
    <div style={{ padding: "18px 0", borderBottom: `1px solid ${T.line}` }}>
      <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.dim, fontWeight: 700, fontFamily: "'Inter',sans-serif", padding: "0 18px", marginBottom: 12 }}>PEOPLE YOU SHOULD KNOW</div>
      <div style={{ display: "flex", gap: 10, padding: "0 18px", overflowX: "auto" }}>
        {SUGGESTED.map(uid => {
          const u = USERS[uid]; const on = !!followed[uid];
          return (
            <div key={uid} style={{
              flexShrink: 0, width: 138, borderRadius: 16, padding: "16px 12px 13px",
              background: T.card, border: `1px solid ${T.line}`,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center",
            }}>
              <Avatar initials={uid} size={58} ring={T.gold} onClick={() => openUser(uid)} />
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 12.5, color: T.cream }}>{u.name.split(" ")[0]} {u.name.split(" ")[1]?.[0]}.</span>
                  {u.verified && <BadgeCheck size={12} color={T.gold} />}
                </div>
                <div style={{ fontSize: 10.5, color: T.dim, fontFamily: "'Inter',sans-serif", marginTop: 2, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{u.role.split("·")[0].trim()}</div>
              </div>
              <button onClick={() => setFollowed(f => ({ ...f, [uid]: !f[uid] }))} style={{
                width: "100%", padding: "8px 0", borderRadius: 999, cursor: "pointer",
                border: on ? `1px solid ${T.line}` : "none",
                background: on ? "transparent" : `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})`,
                color: on ? T.dim : T.ink, fontSize: 12, fontWeight: 700, fontFamily: "'Inter',sans-serif",
              }}>{on ? "Following" : "Follow"}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Post = ({ p, openUser, member }) => {
  const u = p.me ? null : USERS[p.uid];
  const name = p.me ? (member?.name || "You") : u.name;
  return (
    <div style={{ padding: "16px 18px", borderBottom: `1px solid ${T.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 11 }}>
        <Avatar initials={p.me ? "LA" : p.uid} size={42} onClick={() => !p.me && openUser(p.uid)} />
        <div style={{ flex: 1, minWidth: 0, cursor: p.me ? "default" : "pointer" }} onClick={() => !p.me && openUser(p.uid)}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14, color: T.cream }}>{name}</span>
            {(p.me || u?.verified) && <BadgeCheck size={15} color={T.gold} />}
          </div>
          <span style={{ fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{p.time} ago</span>
        </div>
        <PillarTag name={p.pillar} />
      </div>

      <p style={{ margin: "0 0 12px", fontFamily: "'Inter',sans-serif", fontSize: 14.5, lineHeight: 1.55, color: T.cream }}>{p.text}</p>

      {/* imageUrl is a member upload served from /media; image is a stock key */}
      {(p.imageUrl || p.image) && (
        <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 12, border: `1px solid ${T.line}` }}>
          <img src={p.imageUrl || EVENT_PICS[p.image] || p.image} alt="" style={{ width: "100%", display: "block" }} />
        </div>
      )}

      {p.stat && (
        <div style={{
          background: `linear-gradient(120deg, ${T.gold}14, transparent)`, border: `1px solid ${T.gold}35`,
          borderRadius: 14, padding: "14px 16px", marginBottom: 12, display: "flex", alignItems: "baseline", gap: 10,
        }}>
          <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 34, color: T.gold }}>{p.stat.value}</span>
          <span style={{ fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif", letterSpacing: "0.06em" }}>{p.stat.label.toUpperCase()}</span>
        </div>
      )}

      {p.event && (
        <div style={{
          border: `1px solid ${T.line}`, background: T.ink2, borderRadius: 14, padding: "13px 15px",
          marginBottom: 12, display: "flex", alignItems: "center", gap: 12,
        }}>
          <Calendar size={20} color={T.community} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 13.5, color: T.cream }}>{p.event.name}</div>
            <div style={{ fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{p.event.where} · {p.event.when}</div>
          </div>
          <ChevronRight size={18} color={T.dim} />
        </div>
      )}

      <LikeRow likes={p.likes} comments={p.comments} />
    </div>
  );
};

const Composer = ({ member, onPost, onClose }) => {
  const [text, setText] = useState("");
  const [pic, setPic] = useState(null);          // stock image key
  const [upload, setUpload] = useState(null);    // { url, id } once stored
  const [preview, setPreview] = useState(null);  // local object URL, shown instantly
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const fileRef = React.useRef(null);
  const { getToken } = useAuth();

  // Revoke the object URL when it changes or the composer closes, or the
  // browser holds the blob in memory for the life of the document.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";                  // let the same file be re-picked after an error
    if (!file) return;

    const problem = validateImage(file);
    if (problem) { setErr(problem); return; }

    setErr(null);
    setPic(null);                          // an upload replaces any stock pick
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const saved = await createApi(getToken).uploadImage(file, { kind: "post" });
      setUpload(saved);
    } catch (e2) {
      setErr(e2.message || "Upload failed. Please try again.");
      setPreview(p => { if (p) URL.revokeObjectURL(p); return null; });
    } finally {
      setBusy(false);
    }
  };

  const clearUpload = () => {
    setPreview(p => { if (p) URL.revokeObjectURL(p); return null; });
    setUpload(null);
    setErr(null);
  };

  const canPost = (text.trim() || pic || upload) && !busy;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 45, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "#00000090", backdropFilter: "blur(3px)" }} />
      <div style={{
        position: "relative", background: T.ink2, borderRadius: "22px 22px 0 0",
        border: `1px solid ${T.line}`, borderBottom: "none", padding: "18px 18px calc(18px + env(safe-area-inset-bottom))",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 16, color: T.cream }}>New post</span>
          <X size={22} color={T.dim} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <div style={{ display: "flex", gap: 11, marginBottom: 14 }}>
          <Avatar initials="LA" size={40} />
          <textarea value={text} onChange={e => setText(e.target.value)} rows={3} autoFocus
            placeholder="Share something with the community…"
            style={{
              flex: 1, padding: "12px 14px", borderRadius: 14, outline: "none", resize: "none",
              background: T.card, border: `1px solid ${T.line}`, color: T.cream,
              fontSize: 14.5, lineHeight: 1.5, fontFamily: "'Inter',sans-serif", boxSizing: "border-box",
            }} />
        </div>
        <div style={{ fontSize: 11, letterSpacing: "0.12em", color: T.dim, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 9 }}>ADD A PHOTO</div>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          onChange={pickFile}
          style={{ display: "none" }}
        />

        {preview ? (
          <div style={{ position: "relative", marginBottom: 12 }}>
            <img src={preview} alt="" style={{
              width: "100%", maxHeight: 190, objectFit: "cover",
              borderRadius: 14, border: `1px solid ${T.line}`,
              opacity: busy ? 0.55 : 1, transition: "opacity 0.2s",
            }} />
            {busy && (
              <div style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 12.5, fontWeight: 700, color: T.cream,
                fontFamily: "'Inter',sans-serif",
              }}>Uploading…</div>
            )}
            {!busy && (
              <button onClick={clearUpload} aria-label="Remove photo" style={{
                position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
                border: "none", cursor: "pointer", background: "#00000099",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><X size={16} color="#FFF" /></button>
            )}
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} style={{
            width: "100%", padding: "13px 0", marginBottom: 12, borderRadius: 14,
            border: `1px dashed ${T.gold}80`, background: `${T.gold}0E`, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            color: T.gold, fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13.5,
          }}>
            <ImagePlus size={17} />Upload from your device
          </button>
        )}

        {err && (
          <div style={{
            marginBottom: 12, padding: "9px 12px", borderRadius: 10, fontSize: 12.5,
            lineHeight: 1.45, fontFamily: "'Inter',sans-serif",
            background: "rgba(200,60,60,0.10)", border: "1px solid rgba(200,60,60,0.35)", color: "#B4483F",
          }}>{err}</div>
        )}

        <div style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif", marginBottom: 9 }}>
          or pick one of ours
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16 }}>
          {Object.keys(EVENT_PICS).map(k => (
            <div key={k} onClick={() => { clearUpload(); setPic(p => p === k ? null : k); }} style={{
              flexShrink: 0, width: 82, height: 60, borderRadius: 10, overflow: "hidden", cursor: "pointer",
              border: pic === k ? `2.5px solid ${T.gold}` : `1px solid ${T.line}`,
              opacity: pic && pic !== k ? 0.45 : 1, transition: "all 0.15s",
            }}>
              <img src={EVENT_PICS[k]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ))}
        </div>
        <button
          disabled={!canPost}
          onClick={() => {
            onPost({
              me: true, time: "now", pillar: "Community",
              text: text.trim() || "📸",
              image: pic, imageUrl: upload?.url || null, mediaId: upload?.id || null,
              likes: 0, comments: 0,
            });
            onClose();
          }}
          style={{
            width: "100%", padding: "15px 0", borderRadius: 999, border: "none",
            cursor: canPost ? "pointer" : "default",
            background: canPost ? `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})` : T.card,
            color: canPost ? T.ink : T.dim,
            fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14.5,
          }}>{busy ? "Uploading…" : "Post to the feed"}</button>
      </div>
    </div>
  );
};

const Feed = ({ openUser, openConcierge, openRoom, member }) => {
  const [posts, setPosts] = useState(POSTS);
  const [composing, setComposing] = useState(false);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div>
      <div style={{ padding: "16px 18px 0", fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 22, color: T.cream }}>
        {greet}{member?.name ? `, ${member.name.split(" ")[0]}` : ""}.
      </div>
      <AIBriefing openConcierge={openConcierge} member={member} />

      {/* composer bar */}
      <div onClick={() => setComposing(true)} style={{
        margin: "12px 18px 0", display: "flex", alignItems: "center", gap: 11, cursor: "pointer",
        background: T.card, border: `1px solid ${T.line}`, borderRadius: 999, padding: "10px 14px",
      }}>
        <Avatar initials="LA" size={34} />
        <span style={{ flex: 1, fontSize: 13.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>Share something with the community…</span>
        <ImagePlus size={19} color={T.gold} />
      </div>

      <LiveStrip openRoom={openRoom} />

      {posts.slice(0, 2).map((p, i) => <Post key={i} p={p} openUser={openUser} member={member} />)}
      <SuggestedStrip openUser={openUser} />
      {posts.slice(2).map((p, i) => <Post key={i + 2} p={p} openUser={openUser} member={member} />)}
      <div style={{ height: 90 }} />

      {composing && <Composer member={member} onClose={() => setComposing(false)}
        onPost={p => setPosts(prev => [p, ...prev])} />}
    </div>
  );
};


const SectionTitle = ({ eyebrow, title }) => (
  <div style={{ padding: "22px 18px 14px" }}>
    <div style={{ fontSize: 11, letterSpacing: "0.18em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 6 }}>{eyebrow}</div>
    <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 26, color: T.cream, letterSpacing: "-0.01em" }}>{title}</div>
  </div>
);

const Connect = ({ openUser }) => (
  <div>
    <SectionTitle eyebrow="MEET · AI MATCHING" title="Made for you this week" />
    <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      {MATCHES.map(m => {
        const u = USERS[m.uid];
        return (
          <div key={m.uid} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Avatar initials={m.uid} size={50} ring={T.connect} onClick={() => openUser(m.uid)} />
              <div style={{ flex: 1, cursor: "pointer" }} onClick={() => openUser(m.uid)}>
                <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: T.cream }}>{u.name}</div>
                <div style={{ fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{u.role}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 20, color: T.connect }}>{m.score}</div>
                <div style={{ fontSize: 9.5, color: T.dim, letterSpacing: "0.1em" }}>MATCH</div>
              </div>
            </div>
            <div style={{
              marginTop: 12, display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: T.connect,
              fontFamily: "'Inter',sans-serif", background: `${T.connect}12`, padding: "8px 12px", borderRadius: 10,
            }}><AgentMark size={14} color={T.connect} />{m.why}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button style={{
                flex: 1, padding: "11px 0", borderRadius: 999, border: "none", background: T.gold,
                fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13.5, color: T.ink, cursor: "pointer",
              }}>Say hello</button>
              <button onClick={() => openUser(m.uid)} style={{
                flex: 1, padding: "11px 0", borderRadius: 999, border: `1px solid ${T.line}`, background: "transparent",
                fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 13.5, color: T.cream, cursor: "pointer",
              }}>View profile</button>
            </div>
          </div>
        );
      })}
    </div>
    <div style={{ height: 90 }} />
  </div>
);

const Events = ({ openEvent }) => (
  <div>
    <SectionTitle eyebrow="150+ HOSTED" title="Upcoming events" />
    <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      {EVENTS.map(e => (
        <div key={e.id} onClick={() => openEvent(e.id)} style={{ display: "flex", gap: 14, background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: 16, alignItems: "center", cursor: "pointer" }}>
          <div style={{
            width: 54, height: 60, borderRadius: 14, background: T.ink2, border: `1px solid ${T.line}`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 21, color: T.gold }}>{e.date}</span>
            <span style={{ fontSize: 10, letterSpacing: "0.12em", color: T.dim }}>{e.month}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14.5, color: T.cream, marginBottom: 3 }}>{e.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
              <MapPin size={12} />{e.where}</div>
            <div style={{ marginTop: 7 }}><PillarTag name={e.tag} /></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            <div style={{ fontSize: 11.5, color: e.spots.includes("left") ? T.community : T.dim, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>{e.spots}</div>
            <ChevronRight size={17} color={T.dim} />
          </div>
        </div>
      ))}
    </div>
    <div style={{ height: 90 }} />
  </div>
);

const EventDetail = ({ event, onBack, openUser, member }) => {
  const [rsvp, setRsvp] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const host = USERS[event.host];
  return (
    <div style={{ position: "absolute", inset: 0, background: T.ink, zIndex: 30, display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 14px 12px", borderBottom: `1px solid ${T.line}`,
        background: `${T.ink}F0`, backdropFilter: "blur(12px)",
      }}>
        <ChevronLeft size={24} color={T.cream} style={{ cursor: "pointer" }} onClick={onBack} />
        <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: T.cream }}>Event</span>
        <Share2 size={20} color={T.cream} />
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* hero */}
        {event.image && (
          <div style={{ margin: "18px 18px 0", borderRadius: 20, overflow: "hidden", border: `1px solid ${T.line}` }}>
            <img src={EVENT_PICS[event.image]} alt="" style={{ width: "100%", display: "block" }} />
          </div>
        )}
        <div style={{
          margin: 18, borderRadius: 20, padding: "26px 20px",
          background: `linear-gradient(145deg, ${T[PILLAR[event.tag].k]}26, ${T.ink2} 75%)`,
          border: `1px solid ${T[PILLAR[event.tag].k]}45`,
        }}>
          <PillarTag name={event.tag} />
          <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 27, color: T.cream, lineHeight: 1.15, margin: "12px 0 14px" }}>{event.name}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[[Calendar, `${event.date} ${event.month} · ${event.time}`], [MapPin, event.where]].map(([Ico, txt], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: T.cream, fontFamily: "'Inter',sans-serif" }}>
                <Ico size={15} color={T.gold} />{txt}
              </div>
            ))}
          </div>
        </div>

        {/* host */}
        <div onClick={() => openUser(host.id)} style={{
          margin: "0 18px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
          background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: "13px 15px",
        }}>
          <Avatar initials={host.id} size={42} ring={T.gold} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif", letterSpacing: "0.08em" }}>HOSTED BY</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14, color: T.cream }}>{host.name}</span>
              {host.verified && <BadgeCheck size={14} color={T.gold} />}
            </div>
          </div>
          <ChevronRight size={17} color={T.dim} />
        </div>

        {/* about */}
        <div style={{ padding: "0 18px 18px" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 8 }}>ABOUT</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: T.cream, fontFamily: "'Inter',sans-serif" }}>{event.about}</p>
        </div>

        {/* agenda */}
        <div style={{ padding: "0 18px 18px" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 10 }}>AGENDA</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {event.agenda.map(([time, item], i) => (
              <div key={i} style={{ display: "flex", gap: 14, padding: "10px 0", borderBottom: i < event.agenda.length - 1 ? `1px solid ${T.line}` : "none" }}>
                <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 13, color: T.gold, width: 46, flexShrink: 0 }}>{time}</span>
                <span style={{ fontSize: 13.5, color: T.cream, fontFamily: "'Inter',sans-serif" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* who's going */}
        <div style={{ padding: "0 18px 18px" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 10 }}>WHO'S GOING</div>
          <div style={{ display: "flex", alignItems: "center" }}>
            {event.going.map((uid, i) => (
              <div key={uid} onClick={() => openUser(uid)} style={{ marginLeft: i === 0 ? 0 : -10, cursor: "pointer" }}>
                <Avatar initials={uid} size={40} ring={T.ink} />
              </div>
            ))}
            <span style={{ marginLeft: 12, fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
              {event.going.map(u => USERS[u].name.split(" ")[0]).slice(0, 2).join(", ")} and {event.going.length - 2 > 0 ? `${event.going.length - 2} others` : "others"} are going
            </span>
          </div>
        </div>
        <div style={{ height: 110 }} />
      </div>

      {/* RSVP bar */}
      <div style={{ padding: "12px 18px calc(16px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.line}`, background: T.ink }}>
        <button onClick={() => rsvp ? setShowTicket(true) : setConfirming(true)} style={{
          width: "100%", padding: "16px 0", borderRadius: 999, cursor: "pointer",
          border: rsvp ? `1px solid ${T.community}` : "none",
          background: rsvp ? "transparent" : `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})`,
          fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15,
          color: rsvp ? T.community : T.ink,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>{rsvp ? (<><Ticket size={17} />You're going — view ticket</>) : "RSVP — Reserve my seat"}</button>
      </div>

      {/* RSVP confirmation sheet */}
      {confirming && (
        <div style={{ position: "absolute", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setConfirming(false)} style={{ position: "absolute", inset: 0, background: "#00000090", backdropFilter: "blur(3px)" }} />
          <div style={{
            position: "relative", background: T.ink2, borderRadius: "22px 22px 0 0",
            border: `1px solid ${T.line}`, borderBottom: "none",
            padding: "20px 20px calc(20px + env(safe-area-inset-bottom))",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 17, color: T.cream }}>Confirm your RSVP</span>
              <X size={22} color={T.dim} style={{ cursor: "pointer" }} onClick={() => setConfirming(false)} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
              {[
                [Calendar, "Date & time", `${event.date} ${event.month} 2026 · ${event.time}`],
                [MapPin, "Location", event.where],
                [Users, "Going", `${event.going.length + 12} members confirmed`],
                [Ticket, "Your seat", "Member — free"],
              ].map(([Ico, label, val]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                    background: T.card, border: `1px solid ${T.line}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}><Ico size={16} color={T.gold} /></div>
                  <div>
                    <div style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif", letterSpacing: "0.06em" }}>{label.toUpperCase()}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.cream, fontFamily: "'Inter',sans-serif" }}>{val}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { setRsvp(true); setConfirming(false); setShowTicket(true); }} style={{
              width: "100%", padding: "15px 0", borderRadius: 999, border: "none", cursor: "pointer",
              background: `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})`,
              color: T.ink, fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14.5,
            }}>Confirm — see you there</button>
          </div>
        </div>
      )}

      {/* ticket */}
      {showTicket && (
        <div style={{ position: "absolute", inset: 0, zIndex: 41, display: "flex", alignItems: "center", justifyContent: "center", padding: 26 }}>
          <div onClick={() => setShowTicket(false)} style={{ position: "absolute", inset: 0, background: "#000000C8", backdropFilter: "blur(5px)" }} />
          <div style={{
            position: "relative", width: "100%", maxWidth: 330, borderRadius: 24, overflow: "hidden",
            background: `linear-gradient(160deg, ${T.gold}, ${T.goldSoft})`, padding: "24px 22px",
            animation: "ffgStepIn 0.4s cubic-bezier(.2,.8,.2,1)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <img src={LOGO_DARK_MARK} alt="" style={{ width: 30, height: 30 }} />
              <span style={{ fontSize: 10, letterSpacing: "0.2em", fontWeight: 800, color: "#0A0A0DAA", fontFamily: "'Inter',sans-serif" }}>MEMBER TICKET</span>
            </div>
            <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 22, lineHeight: 1.2, color: "#0A0A0D", marginBottom: 14 }}>{event.name}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 18 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0D", fontFamily: "'Inter',sans-serif" }}>{event.date} {event.month} 2026 · {event.time}</span>
              <span style={{ fontSize: 12.5, color: "#0A0A0DB0", fontFamily: "'Inter',sans-serif" }}>{event.where}</span>
              <span style={{ fontSize: 12.5, color: "#0A0A0DB0", fontFamily: "'Inter',sans-serif" }}>{member?.name || "FFG Member"} · Admit one</span>
            </div>
            {/* stylised QR */}
            <div style={{ background: "#0A0A0D", borderRadius: 16, padding: 14, display: "flex", justifyContent: "center" }}>
              <svg width="110" height="110" viewBox="0 0 21 21">
                {Array.from({ length: 21 * 21 }).map((_, i) => {
                  const x = i % 21, y = Math.floor(i / 21);
                  const corner = (x < 5 && y < 5) || (x > 15 && y < 5) || (x < 5 && y > 15);
                  const edge = corner && (x === 0 || y === 0 || x === 4 || y === 4 || x === 16 || y === 20 || x === 20 || y === 16);
                  const centerDot = corner && x > 1 && x < 3.5 && y > 1 && y < 3.5;
                  const fill = corner ? (edge || centerDot) : ((x * 7 + y * 13 + x * y) % 5 < 2 && x > 5 && y > 5) || ((x * 3 + y * 11) % 7 < 2);
                  return fill ? <rect key={i} x={x} y={y} width="1" height="1" fill={T.goldSoft} /> : null;
                })}
              </svg>
            </div>
            <div style={{ textAlign: "center", marginTop: 12, fontSize: 10.5, color: "#0A0A0D90", fontFamily: "'Inter',sans-serif", letterSpacing: "0.08em" }}>SCAN AT THE DOOR · TAP ANYWHERE TO CLOSE</div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------- rooms (clubhouse-style) ---------- */
const Rooms = ({ openRoom, openUser }) => (
  <div>
    <SectionTitle eyebrow="LIVE AUDIO · DROP IN" title="Rooms" />
    <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      {ROOMS.map(r => (
        <div key={r.id} onClick={() => r.live && openRoom(r.id)} style={{
          background: T.card, border: `1px solid ${r.live ? `${T.gold}45` : T.line}`,
          borderRadius: 18, padding: 16, cursor: r.live ? "pointer" : "default",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
            {r.live ? (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700,
                letterSpacing: "0.1em", color: T.gold, fontFamily: "'Inter',sans-serif",
              }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: T.gold, animation: "ffgPulse 1.6s infinite" }} />LIVE
              </span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>
                <Clock size={12} />{r.when}
              </span>
            )}
            <PillarTag name={r.tag} />
          </div>

          <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 16.5, color: T.cream, lineHeight: 1.3, marginBottom: 5 }}>{r.title}</div>
          <div style={{ fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif", marginBottom: 13 }}>{r.desc}</div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              {r.speakers.map((uid, i) => (
                <div key={uid} style={{ marginLeft: i === 0 ? 0 : -9 }} onClick={e => { e.stopPropagation(); openUser(uid); }}>
                  <Avatar initials={uid} size={34} ring={T.card} />
                </div>
              ))}
              <span style={{ marginLeft: 10, fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
                {r.speakers.map(u => USERS[u].name.split(" ")[0]).join(", ")}
              </span>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: r.live ? T.cream : T.dim, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>
              {r.live ? <Radio size={13} color={T.gold} /> : <Users size={13} />}{r.listeners}
            </span>
          </div>
        </div>
      ))}
    </div>
    <style>{`@keyframes ffgPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }`}</style>
    <div style={{ height: 90 }} />
  </div>
);

const RoomView = ({ room, onLeave, openUser }) => {
  const [muted, setMuted] = useState(true);
  const [hand, setHand] = useState(false);
  const audience = Object.keys(USERS).filter(u => !room.speakers.includes(u)).slice(0, 8);
  return (
    <div style={{ position: "absolute", inset: 0, background: T.ink, zIndex: 30, display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px 12px", borderBottom: `1px solid ${T.line}`,
      }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700,
          letterSpacing: "0.1em", color: T.gold, fontFamily: "'Inter',sans-serif",
        }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, background: T.gold, animation: "ffgPulse 1.6s infinite" }} />LIVE · {room.listeners + 1}
        </span>
        <PillarTag name={room.tag} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px" }}>
        <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 21, color: T.cream, lineHeight: 1.25, marginBottom: 22 }}>{room.title}</div>

        <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 14 }}>ON STAGE</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
          {room.speakers.map((uid, i) => {
            const u = USERS[uid];
            const photo = ROOM_PHOTOS[uid] || PHOTOS[uid];
            return (
              <div key={uid} onClick={() => openUser(uid)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <div style={{ position: "relative", width: "100%" }}>
                  {photo ? (
                    <div style={{
                      width: "100%", aspectRatio: "1", borderRadius: 22, overflow: "hidden",
                      border: `2.5px solid ${i === 0 ? T.gold : T.line}`,
                      boxShadow: i === 0 ? `0 0 22px ${T.gold}45` : "none",
                    }}>
                      <img src={photo} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  ) : (
                    <div style={{
                      width: "100%", aspectRatio: "1", borderRadius: 22,
                      border: `2.5px solid ${i === 0 ? T.gold : T.line}`,
                      background: `linear-gradient(135deg, ${T.card}, ${T.ink2})`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 26, color: T.cream,
                    }}>{uid}</div>
                  )}
                  <div style={{
                    position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)",
                    width: 26, height: 26, borderRadius: 13,
                    background: i === 0 ? T.gold : T.card,
                    border: `2px solid ${T.ink}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Mic size={13} color={i === 0 ? T.ink : T.dim} strokeWidth={2.4} />
                  </div>
                </div>
                <div style={{ textAlign: "center", marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: T.cream, fontFamily: "'Inter',sans-serif", fontWeight: 700, display: "block" }}>{u.name.split(" ")[0]}</span>
                  <span style={{ fontSize: 10, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{u.role.split("·")[0].trim()}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.dim, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 14 }}>IN THE ROOM</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {audience.map(uid => (
            <div key={uid} onClick={() => openUser(uid)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <Avatar initials={uid} size={48} />
              <span style={{ fontSize: 10.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{USERS[uid].name.split(" ")[0]}</span>
            </div>
          ))}
        </div>
        <div style={{ height: 40 }} />
      </div>

      {/* controls */}
      <div style={{
        display: "flex", gap: 10, padding: "12px 18px calc(16px + env(safe-area-inset-bottom))",
        borderTop: `1px solid ${T.line}`, background: T.ink,
      }}>
        <button onClick={onLeave} style={{
          flex: 1, padding: "13px 0", borderRadius: 999, border: `1px solid ${T.line}`, cursor: "pointer",
          background: T.card, color: T.community, fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13.5,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        }}><LogOut size={15} />Leave quietly</button>
        <button onClick={() => setHand(h => !h)} style={{
          width: 50, borderRadius: 999, border: `1px solid ${hand ? T.gold : T.line}`, cursor: "pointer",
          background: hand ? `${T.gold}22` : T.card, display: "flex", alignItems: "center", justifyContent: "center",
        }}><Hand size={18} color={hand ? T.gold : T.cream} /></button>
        <button onClick={() => setMuted(m => !m)} style={{
          width: 50, borderRadius: 999, border: `1px solid ${T.line}`, cursor: "pointer",
          background: T.card, display: "flex", alignItems: "center", justifyContent: "center",
        }}>{muted ? <MicOff size={18} color={T.dim} /> : <Mic size={18} color={T.gold} />}</button>
      </div>
    </div>
  );
};

const Capital = () => (
  <div>
    <SectionTitle eyebrow="FFG DIGITAL · ADVISE, POWER, OWN" title="Powered founders" />
    <div style={{ margin: "0 18px 16px", borderRadius: 18, padding: 18, background: `linear-gradient(130deg, ${T.gold}22, ${T.ink2})`, border: `1px solid ${T.gold}40` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Zap size={16} color={T.gold} />
        <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13.5, color: T.gold }}>Cohort One — applications open</span>
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: T.cream, fontFamily: "'Inter',sans-serif" }}>
        Consultancy, funding and hands-on technology support — with FFG taking a stake in your success.
      </p>
      <button style={{
        marginTop: 13, padding: "10px 18px", borderRadius: 999, border: "none", background: T.gold,
        fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13, color: T.ink, cursor: "pointer",
      }}>Apply now</button>
    </div>
    <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      {FOUNDERS.map(f => (
        <div key={f.n} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: 16, display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 15.5, color: T.cream }}>{f.n}</div>
            <div style={{ fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif", marginTop: 2 }}>{f.desc}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end", color: T.gold }}>
              <TrendingUp size={13} /><span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 14.5 }}>{f.raised}</span>
            </div>
            <div style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif", marginTop: 2 }}>{f.stage}</div>
          </div>
        </div>
      ))}
    </div>
    <div style={{ height: 90 }} />
  </div>
);

/* ---------- shell ---------- */
const TABS = [
  { id: "feed", label: "Home", icon: Home },
  { id: "rooms", label: "Rooms", icon: Radio },
  // Labelled "Meet" at the client's request. The id stays `connect` so the
  // Connect *pillar* on profiles, posts, events and rooms is unaffected.
  { id: "connect", label: "Meet", icon: Handshake },
  { id: "events", label: "Events", icon: Calendar },
  { id: "reads", label: "Library", icon: BookOpen },
  // Capital is hidden for now at the client's request — to be revisited later.
  // The <Capital /> screen below is kept intact; restore this entry to bring it
  // back. Note this is only the nav tab: "Capital" as a *pillar* on member
  // profiles, posts, events and rooms stays untouched.
  // { id: "capital", label: "Capital", icon: Banknote },
  { id: "profile", label: "You", icon: User },
];

export default function FFGApp() {
  const vp = useViewport();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { signOut } = useClerk();

  // Restored from localStorage: the Google redirect reloads the page, which
  // would otherwise drop a member back onto the splash screen after sign-in.
  const [entered, setEntered] = useState(() => readFlag("ffg.entered") === "1");
  const [member, setMember] = useState(() => readJSON("ffg.member"));
  const [tab, setTab] = useState("feed");
  T = LIGHT;

  useEffect(() => { if (entered) writeFlag("ffg.entered", "1"); }, [entered]);
  useEffect(() => { if (member) writeJSON("ffg.member", member); }, [member]);
  const [viewUser, setViewUser] = useState(null);
  const [viewRoom, setViewRoom] = useState(null);
  const [viewEvent, setViewEvent] = useState(null);
  const [viewArticle, setViewArticle] = useState(null);
  const [showMessages, setShowMessages] = useState(false);
  const [chatWith, setChatWith] = useState(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [concierge, setConcierge] = useState(false);
  const openUser = uid => setViewUser(uid);

  // The rail is app chrome, so it only appears once the member is actually
  // inside — never behind the splash, onboarding or sign-in overlays.
  const inApp = entered && !!member && !!isSignedIn;
  const showRail = vp.isDesktop && inApp;
  const resetViews = () => {
    setViewUser(null); setViewRoom(null); setViewEvent(null); setViewArticle(null);
    setShowMessages(false); setChatWith(null); setShowNotifs(false); setShowSearch(false);
  };

  return (
    <div style={{
      height: "100dvh", overflow: "hidden",
      background: "#E9E4D9",
      display: "flex", justifyContent: "center", fontFamily: "'Inter',sans-serif",
    }}>
      <style>{`
        .ffg-frame ::-webkit-scrollbar { width: 0; height: 0; }
        .ffg-scroll { -webkit-overflow-scrolling: touch; }
      `}</style>

      {showRail && (
        <DesktopRail
          tabs={TABS}
          tab={tab}
          T={T}
          width={vp.railWidth}
          signedIn={!!isSignedIn}
          onSignOut={() => signOut()}
          onTab={id => { setTab(id); resetViews(); }}
        />
      )}

      <div className="ffg-frame" style={{
        width: "100%", maxWidth: vp.frameWidth ?? "100%", height: "100dvh", background: T.ink,
        position: "relative", overflow: "hidden", display: "flex", flexDirection: "column",
        borderLeft: vp.isPhone ? "none" : `1px solid ${T.line}`,
        borderRight: vp.isPhone ? "none" : `1px solid ${T.line}`,
      }}>
        {/* ambient zodiac field behind the whole app */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
          <ZodiacField density={22} opacity={0.09} color="168, 137, 78" />
        </div>

        {!entered && <Splash onEnter={() => setEntered(true)} />}
        {entered && !member && <Onboarding onComplete={prof => setMember(prof)} />}
        {/* Sign-in sits after onboarding: splash → onboarding → Google → app. */}
        {entered && member && authLoaded && !isSignedIn && <SignInGate T={T} member={member} />}

        {tab !== "profile" && <Header onBell={() => setShowNotifs(true)} onSearch={() => setShowSearch(true)} />}
        <div className="ffg-scroll" style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain" }}>
          {tab === "feed" && <Feed openUser={openUser} openConcierge={() => setConcierge(true)} openRoom={id => setViewRoom(id)} member={member} />}
          {tab === "rooms" && <Rooms openRoom={id => setViewRoom(id)} openUser={openUser} />}
          {tab === "connect" && <Connect openUser={openUser} />}
          {tab === "events" && <Events openEvent={id => setViewEvent(id)} />}
          {tab === "reads" && <Articles openArticle={a => setViewArticle(a)} openUser={openUser} member={member} />}
          {/* Capital screen hidden — see TABS above. */}
          {tab === "profile" && (
            <div style={{ position: "relative", height: "100%" }}>
              <UserProfile user={USERS.LA} onBack={null} member={member} openMessages={() => setShowMessages(true)} openNotifs={() => setShowNotifs(true)} />
            </div>
          )}
        </div>

        {/* messaging + notifications overlays */}
        {showMessages && <MessagesScreen onBack={() => setShowMessages(false)} openChat={uid => setChatWith(uid)} openUser={openUser} />}
        {chatWith && <ChatView uid={chatWith} onBack={() => setChatWith(null)} openUser={openUser} />}
        {showNotifs && <NotificationsScreen onBack={() => setShowNotifs(false)} openUser={openUser} />}

        {/* search — closes as it hands off, so results open on a clean stack */}
        {showSearch && (
          <SearchScreen
            onBack={() => setShowSearch(false)}
            openUser={uid => { setShowSearch(false); setViewUser(uid); }}
            openRoom={id => { setShowSearch(false); setViewRoom(id); }}
            openEvent={id => { setShowSearch(false); setViewEvent(id); }}
            openArticle={a => { setShowSearch(false); setViewArticle(a); }}
          />
        )}

        {/* article reader overlay */}
        {viewArticle && <ArticleReader article={viewArticle} onBack={() => setViewArticle(null)} openUser={openUser} />}

        {/* live room + event detail overlays */}
        {viewEvent && <EventDetail event={EVENTS.find(e => e.id === viewEvent)} onBack={() => setViewEvent(null)} openUser={openUser} member={member} />}
        {viewRoom && <RoomView room={ROOMS.find(r => r.id === viewRoom)} onLeave={() => setViewRoom(null)} openUser={openUser} />}

        {/* visiting another member's profile */}
        {viewUser && <UserProfile user={USERS[viewUser]} onBack={() => setViewUser(null)} member={member} openChat={uid => { setViewUser(null); setChatWith(uid); }} />}

        {/* AI concierge — floating direct line to the group */}
        {!concierge && entered && member && (
          <button onClick={() => setConcierge(true)} style={{
            position: "absolute",
            bottom: showRail ? 26 : "calc(96px + env(safe-area-inset-bottom))",
            right: 18, zIndex: 42,
            width: 56, height: 56, borderRadius: "50%", border: `1px solid ${T.goldSoft}`, cursor: "pointer",
            background: `linear-gradient(135deg, ${T.gold}, ${T.goldSoft})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 6px 24px ${T.gold}50`,
          }}>
            <AgentMark size={26} color={T.ink} strokeWidth={2.2} />
          </button>
        )}
        {concierge && <Concierge onClose={() => setConcierge(false)} />}

        {/* bottom nav — touch layouts only; desktop gets the left rail instead */}
        {!showRail && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          display: "flex", justifyContent: "space-around",
          padding: "10px 4px calc(14px + env(safe-area-inset-bottom))",
          background: `${T.ink}F5`, backdropFilter: "blur(14px)", borderTop: `1px solid ${T.line}`, zIndex: 40,
        }}>
          {TABS.map(t => {
            const Ico = t.icon; const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => { setTab(t.id); resetViews(); }} style={{
                background: "none", border: "none", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "2px 6px",
                color: on ? T.gold : T.dim, transition: "color 0.2s",
              }}>
                <Ico size={22} strokeWidth={on ? 2.4 : 2} />
                <span style={{ fontSize: 10.5, fontFamily: "'Inter',sans-serif", fontWeight: on ? 700 : 500 }}>{t.label}</span>
              </button>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}
