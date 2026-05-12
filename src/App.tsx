/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  Timestamp, 
  addDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  orderBy,
  limit
} from "firebase/firestore";
import { 
  Briefcase, 
  GraduationCap, 
  Users, 
  LayoutDashboard, 
  Sparkles, 
  Plus, 
  Award,
  LogOut, 
  CircleUser,
  ChevronRight,
  ChevronLeft,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  Target,
  Trophy,
  Star,
  MessageSquare,
  TrendingUp,
  Map,
  ArrowRight,
  Menu,
  ShieldCheck,
  X,
  Settings
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { auth, db, signIn, logout } from "./lib/firebase";
import { 
  UserProfile, 
  MentorshipPost, 
  Pairing, 
  OperationType, 
  ProficiencyLevel, 
  UserSkillExpert, 
  UserSkillInterested,
  SessionFeedback,
  Endorsement,
  GlobalSkill,
  LearningResource,
  InternalGig,
  SkillAssessment
} from "./types";
import { handleFirestoreError } from "./lib/errorUtils";
import { getSkillGapAnalyses, getMentorRecommendations } from "./services/geminiService";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<"feed" | "learning" | "gigs" | "insights" | "dashboard" | "ai-lab" | "admin">("feed");
  const [posts, setPosts] = useState<MentorshipPost[]>([]);
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [assessments, setAssessments] = useState<SkillAssessment[]>([]);
  const [gigs, setGigs] = useState<InternalGig[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [globalSkills, setGlobalSkills] = useState<GlobalSkill[]>([]);
  const [feedbacks, setFeedbacks] = useState<SessionFeedback[]>([]);
  const [verifyingSkill, setVerifyingSkill] = useState<string | null>(null);

  const handleSignIn = async () => {
    setIsAuthenticating(true);
    try {
      await signIn();
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await fetchOrCreateProfile(u);
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Profile Fetch/Create
  const fetchOrCreateProfile = async (u: User) => {
    const userDocRef = doc(db, "users", u.uid);
    try {
      let userDoc;
      try {
        userDoc = await getDoc(userDocRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${u.uid}`);
        return;
      }

      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        if (u.email === 'mvnsaikiran123@gmail.com' && !data.isAdmin) {
          try {
            await updateDoc(userDocRef, { isAdmin: true });
            data.isAdmin = true;
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `users/${u.uid}`);
          }
        }
        setProfile(data);
      } else {
        const newProfile = {
          uid: u.uid,
          displayName: u.displayName || "Employee",
          email: u.email || "",
          photoURL: u.photoURL || undefined,
          skillsExpert: [],
          skillsInterested: [],
          isMentor: false,
          points: 0,
          level: 1,
          badges: [],
          isAdmin: u.email === 'mvnsaikiran123@gmail.com',
          createdAt: serverTimestamp(),
        };
        try {
          await setDoc(userDocRef, newProfile);
          setProfile(newProfile as any);
          setShowOnboarding(true);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${u.uid}`);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const awardPoints = async (userId: string, points: number, badge?: string) => {
    const userRef = doc(db, "users", userId);
    try {
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        const currentPoints = data.points || 0;
        const newPoints = currentPoints + points;
        const newLevel = Math.floor(newPoints / 100) + 1;
        
        const updates: any = {
          points: newPoints,
          level: newLevel,
        };

        if (badge && !(data.badges || []).includes(badge)) {
          updates.badges = [...(data.badges || []), badge];
        }

        await updateDoc(userRef, updates);
        
        if (userId === user?.uid) {
          setProfile(prev => prev ? { ...prev, ...updates } : null);
        }
      }
    } catch (err) {
      console.error("Error awarding points:", err);
    }
  };

  // Subscriptions
  useEffect(() => {
    if (!user) return;

    // Posts Feed
    const postsQuery = query(collection(db, "posts"), where("status", "==", "active"));
    const unsubPosts = onSnapshot(postsQuery, (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as MentorshipPost)));
    }, (error) => {
      console.error("Posts subscription error:", error);
    });

    // My Pairings
    const mentorPairingsQuery = query(collection(db, "pairings"), where("mentorId", "==", user.uid));
    const menteePairingsQuery = query(collection(db, "pairings"), where("menteeId", "==", user.uid));

    const unsubMentor = onSnapshot(mentorPairingsQuery, (snap) => {
      const mentorPairings = snap.docs.map(d => ({ id: d.id, ...d.data() } as Pairing));
      setPairings(prev => {
        const otherPairings = prev.filter(p => p.menteeId === user.uid);
        return [...otherPairings, ...mentorPairings].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      });
    }, (error) => {
      console.error("Mentor pairings error:", error);
    });

    const unsubMentee = onSnapshot(menteePairingsQuery, (snap) => {
      const menteePairings = snap.docs.map(d => ({ id: d.id, ...d.data() } as Pairing));
      setPairings(prev => {
        const otherPairings = prev.filter(p => p.mentorId === user.uid);
        return [...otherPairings, ...menteePairings].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      });
    }, (error) => {
      console.error("Mentee pairings error:", error);
    });

    // Endorsements
    const endorsementsQuery = query(collection(db, "endorsements"));
    const unsubEndorsements = onSnapshot(endorsementsQuery, (snap) => {
      setEndorsements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Endorsement)));
    }, (error) => {
      console.error("Endorsements subscription error:", error);
    });

    // Leaderboard
    const leaderboardQuery = query(collection(db, "users"), orderBy("points", "desc"), limit(10));
    const unsubLeaderboard = onSnapshot(leaderboardQuery, (snap) => {
      setLeaderboard(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    }, (error) => {
      console.error("Leaderboard subscription error:", error);
    });

    // Global Skills
    const skillsQuery = query(collection(db, "skills"), orderBy("name", "asc"));
    const unsubSkills = onSnapshot(skillsQuery, (snap) => {
      setGlobalSkills(snap.docs.map(d => ({ id: d.id, ...d.data() } as GlobalSkill)));
    }, (error) => {
      console.error("Skills subscription error:", error);
    });

    // Feedback
    const feedbackQuery = profile?.isAdmin 
      ? query(collection(db, "feedback"), orderBy("createdAt", "desc"))
      : query(collection(db, "feedback"), where("menteeId", "==", user.uid));
    
    const unsubFeedback = onSnapshot(feedbackQuery, (snap) => {
      setFeedbacks(snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionFeedback)));
    }, (error) => {
      console.error("Feedback subscription error:", error);
    });

    // Learning Resources
    const unsubResources = onSnapshot(collection(db, "resources"), (snap) => {
      setResources(snap.docs.map(d => ({ id: d.id, ...d.data() } as LearningResource)));
    }, (error) => {
      console.error("Resources subscription error:", error);
    });

    // Assessments
    const assessmentQuery = profile?.isAdmin 
      ? collection(db, "assessments") 
      : query(collection(db, "assessments"), where("userId", "==", user.uid));

    const unsubAssessments = onSnapshot(assessmentQuery, (snap) => {
      setAssessments(snap.docs.map(d => ({ id: d.id, ...d.data() } as SkillAssessment)));
    }, (error) => {
      console.error("Assessments subscription error:", error);
    });

    // Internal Gigs
    const unsubGigs = onSnapshot(collection(db, "gigs"), (snap) => {
      setGigs(snap.docs.map(d => ({ id: d.id, ...d.data() } as InternalGig)));
    }, (error) => {
      console.error("Gigs subscription error:", error);
    });

    return () => {
      unsubPosts();
      unsubMentor();
      unsubMentee();
      unsubEndorsements();
      unsubLeaderboard();
      unsubSkills();
      unsubFeedback();
      unsubResources();
      unsubAssessments();
      unsubGigs();
    };
  }, [user, profile?.isAdmin]);

  const handleEndorse = async (toUserId: string, skillName: string) => {
    if (!user || !profile) return;
    if (user.uid === toUserId) return;

    // Check if already endorsed
    const existing = endorsements.find(e => e.fromUserId === user.uid && e.toUserId === toUserId && e.skillName === skillName);
    if (existing) {
      alert("You have already endorsed this colleague for this skill.");
      return;
    }

    try {
      await addDoc(collection(db, "endorsements"), {
        fromUserId: user.uid,
        fromUserName: profile.displayName,
        fromUserPhoto: profile.photoURL,
        toUserId,
        skillName,
        createdAt: serverTimestamp()
      });
      
      // Points for recipient
      await awardPoints(toUserId, 20);
      
      // Points for sender (encouraging mentorship culture)
      await awardPoints(user.uid, 5);

      const recipientEndorsements = endorsements.filter(e => e.toUserId === toUserId);
      if (recipientEndorsements.length >= 9) { // 10th endorsement
        await awardPoints(toUserId, 50, "Star");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "endorsements");
    }
  };

  const handleCreatePost = async (type: 'request' | 'offer', skill: string, description: string) => {
    if (!user || !profile) return;
    try {
      await addDoc(collection(db, "posts"), {
        userId: user.uid,
        userName: profile.displayName,
        userPhoto: profile.photoURL,
        type,
        skill,
        description,
        status: 'active',
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "posts");
    }
  };

  const handleConnect = async (post: MentorshipPost) => {
    if (!user || !profile || post.userId === user.uid) return;
    
    // Check if pairing already exists
    const existing = pairings.find(p => p.skill === post.skill && (p.mentorId === post.userId || p.menteeId === post.userId));
    if (existing) {
      alert("You already have an active request or connection for this skill with this person.");
      return;
    }

    try {
      const isMentor = post.type === 'request'; // Current user is mentor if post is a request
      await addDoc(collection(db, "pairings"), {
        mentorId: isMentor ? user.uid : post.userId,
        menteeId: isMentor ? post.userId : user.uid,
        mentorName: isMentor ? profile.displayName : post.userName,
        menteeName: isMentor ? post.userName : profile.displayName,
        skill: post.skill,
        status: 'pending',
        startDate: serverTimestamp(),
      });
      alert("Connection request sent!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "pairings");
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white enterprise-grid">
        <motion.div 
          animate={{ scale: [1, 1.05, 1], opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="text-4xl font-serif italic text-slate-300 tracking-tighter"
        >
          Arvind.
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] enterprise-grid flex flex-col font-sans">
      {/* Mobile Sidebar / Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100] md:hidden"
            />
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              className="fixed inset-y-0 left-0 w-72 bg-white z-[101] shadow-2xl p-6 md:hidden"
            >
              <div className="flex items-center justify-between mb-12">
                <div className="text-xl font-bold tracking-tight uppercase">
                  ARVIND<span className="text-[var(--color-accent)] font-serif italic lowercase">bridge</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 -mr-2"><X className="w-6 h-6" /></button>
              </div>
              <div className="flex flex-col gap-2">
                <NavButton 
                  mobile
                  active={activeTab === 'feed'} 
                  onClick={() => { setActiveTab('feed'); setMobileMenuOpen(false); }}
                  icon={<LayoutDashboard className="w-5 h-5" />}
                  label="Opportunity Feed"
                />
                <NavButton 
                  mobile
                  active={activeTab === 'dashboard'} 
                  onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
                  icon={<Users className="w-5 h-5" />}
                  label="My Circle"
                />
                <NavButton 
                  mobile
                  active={activeTab === 'ai-lab'} 
                  onClick={() => { setActiveTab('ai-lab'); setMobileMenuOpen(false); }}
                  icon={<Sparkles className="w-5 h-5" />}
                  label="Gap Lab"
                />
                {profile?.isAdmin && (
                  <NavButton 
                    mobile
                    active={activeTab === 'admin'} 
                    onClick={() => { setActiveTab('admin'); setMobileMenuOpen(false); }}
                    icon={<ShieldCheck className="w-5 h-5" />}
                    label="Admin Console"
                  />
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Navbar */}
      <nav className="h-20 border-b border-[var(--color-line)] bg-white/70 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between px-6 lg:px-16">
        <div className="flex items-center gap-6 md:gap-12">
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-2 md:hidden text-gray-500"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="text-2xl font-bold tracking-tighter flex items-center gap-1 uppercase">
            ARVIND<span className="text-[var(--color-accent)] font-serif italic lowercase text-3xl">bridge</span>
          </div>
          
          {user && (
            <div className="hidden md:flex gap-1 bg-slate-100/50 p-1 rounded-2xl border border-slate-200/50">
              <NavButton 
                active={activeTab === 'feed'} 
                onClick={() => setActiveTab('feed')}
                icon={<LayoutDashboard className="w-4 h-4" />}
                label="Exchange"
              />
              <NavButton 
                active={activeTab === 'learning'} 
                onClick={() => setActiveTab('learning')}
                icon={<GraduationCap className="w-4 h-4" />}
                label="Learning Hub"
              />
              <NavButton 
                active={activeTab === 'gigs'} 
                onClick={() => setActiveTab('gigs')}
                icon={<Briefcase className="w-4 h-4" />}
                label="Opportunities"
              />
              <NavButton 
                active={activeTab === 'dashboard'} 
                onClick={() => setActiveTab('dashboard')}
                icon={<Users className="w-4 h-4" />}
                label="My Circle"
              />
              <NavButton 
                active={activeTab === 'insights'} 
                onClick={() => setActiveTab('insights')}
                icon={<TrendingUp className="w-4 h-4" />}
                label="Skill DNA"
              />
              <NavButton 
                active={activeTab === 'ai-lab'} 
                onClick={() => setActiveTab('ai-lab')}
                icon={<Sparkles className="w-4 h-4" />}
                label="Gap Lab"
              />
              {profile?.isAdmin && (
                <NavButton 
                  active={activeTab === 'admin'} 
                  onClick={() => setActiveTab('admin')}
                  icon={<ShieldCheck className="w-4 h-4" />}
                  label="Admin"
                />
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          {!user ? (
            <button 
              onClick={handleSignIn}
              disabled={isAuthenticating}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-full font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50 shadow-lg shadow-slate-900/10"
            >
              {isAuthenticating ? "Authenticating..." : "Sign In"}
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsEditingProfile(true)}
                className="flex items-center gap-3 pl-1 pr-4 py-1.5 rounded-full hover:bg-white border border-transparent hover:border-slate-200 transition-all hover:shadow-sm"
                id="profile-trigger"
              >
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="" className="w-8 h-8 rounded-full border border-slate-200 shadow-sm" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                    <CircleUser className="w-5 h-5 text-slate-400" />
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold leading-none text-slate-900">{profile?.displayName}</div>
                  <div className="text-[10px] text-slate-400 font-medium tracking-tight mt-0.5">{profile?.title || 'Contributor'}</div>
                </div>
              </button>
              <button 
                onClick={logout}
                className="p-2 text-slate-300 hover:text-slate-900 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 lg:p-16">
        {!user ? (
          <div className="flex flex-col items-center justify-center mt-12 md:mt-24 text-center">
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 className="text-7xl md:text-9xl font-bold tracking-tighter max-w-5xl leading-[0.85] mb-12 text-slate-900">
                The next chapter of your <span className="font-serif italic text-blue-600 font-light">career</span> starts with a partner.
              </h1>
              <p className="text-slate-400 text-xl md:text-2xl max-w-2xl mx-auto mb-16 leading-relaxed font-light">
                Bridge the gap between where you are and where you want to be. Connect with internal mentors, exchange skills, and help others grow.
              </p>
              <button 
                onClick={handleSignIn}
                disabled={isAuthenticating}
                className="group relative inline-flex items-center gap-4 px-10 py-5 bg-slate-900 text-white rounded-full overflow-hidden transition-all hover:bg-black disabled:opacity-70 shadow-2xl shadow-slate-900/20"
              >
                <span className="font-bold text-lg">{isAuthenticating ? "Opening Secure Window..." : "Join the Talent Network"}</span>
                <ChevronRight className={`w-5 h-5 transition-all ${isAuthenticating ? 'opacity-0' : 'group-hover:translate-x-2'}`} />
              </button>
            </motion.div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'feed' && (
              <motion.div 
                key="feed"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-8"
              >
                <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
                  <div className="space-y-3">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 italic font-serif">Exchange</h2>
                    <p className="text-slate-400 font-medium text-lg">Cross-department knowledge sharing and opportunity matching.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
                    <div className="relative group flex-1 sm:flex-none">
                      <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                      <input 
                        type="text"
                        placeholder="Search skill or colleague..."
                        aria-label="Search skills or colleagues"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full sm:min-w-[320px] pl-11 pr-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all shadow-sm"
                      />
                    </div>
                    <PostCreator onPost={handleCreatePost} />
                  </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {posts.filter(p => 
                    p.skill.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    p.userName.toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0 ? (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-200 rounded-3xl">
                      <Filter className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-400">
                        {searchQuery ? `No matches found for "${searchQuery}"` : "No active requests found. Be the first to post!"}
                      </p>
                      {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="mt-2 text-sm font-bold text-[var(--color-accent)]">Clear search</button>
                      )}
                    </div>
                  ) : (
                    posts
                      .filter(p => 
                        p.skill.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        p.userName.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((post) => {
                        const userStats = leaderboard.find(u => u.uid === post.userId);
                        return (
                          <PostCard 
                            key={post.id} 
                            post={post} 
                            onConnect={() => handleConnect(post)} 
                            isOwn={post.userId === user.uid} 
                            onViewProfile={async () => {
                              const docSnap = await getDoc(doc(db, "users", post.userId));
                              if (docSnap.exists()) {
                                setViewingProfile(docSnap.data() as UserProfile);
                              }
                            }}
                            points={userStats?.points}
                            level={userStats?.level}
                          />
                        );
                      })
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'learning' && (
              <LearningHub resources={resources} onAddLearning={(r) => awardPoints(user.uid, 10)} />
            )}

            {activeTab === 'gigs' && (
              <GigMarketplace gigs={gigs} />
            )}

            {activeTab === 'insights' && (
              <SkillAnalytics 
                users={leaderboard} 
                skills={globalSkills} 
              />
            )}

            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-12"
              >
                <div className="lg:col-span-8 space-y-16">
                  <section className="space-y-8">
                    <div className="flex items-center justify-between">
                      <h3 className="text-3xl font-bold tracking-tight text-slate-900">Connections</h3>
                      <div className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-100">
                        {pairings.filter(p => p.status === 'active').length} Active
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {pairings.length === 0 ? (
                        <div className="col-span-full py-20 px-8 bg-slate-50 rounded-[2.5rem] flex flex-col items-center border border-slate-100 border-dashed">
                          <Users className="w-10 h-10 text-slate-200 mb-4" />
                          <p className="text-slate-400 font-medium">Your partnership list is ready for growth.</p>
                          <button onClick={() => setActiveTab('feed')} className="text-blue-600 text-sm font-bold mt-4 hover:underline">Discover Colleagues →</button>
                        </div>
                      ) : (
                        pairings.map(pairing => (
                          <PairingCard key={pairing.id} pairing={pairing} currentUserId={user.uid} onAwardPoints={awardPoints} />
                        ))
                      )}
                    </div>
                  </section>

                  <section className="space-y-8">
                     <h3 className="text-3xl font-bold tracking-tight text-slate-900">Expertise Pulse</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                       <SkillPulseCard 
                         title="Verified Expertise" 
                         list={profile?.skillsExpert || []} 
                         color="indigo" 
                         targetUserId={user?.uid}
                         verifiedSkills={profile?.verifiedSkills}
                         endorsements={endorsements.filter(e => e.toUserId === user?.uid)}
                         onVerify={(s) => setVerifyingSkill(s)}
                       />
                       <SkillPulseCard 
                         title="Learning Goals" 
                         list={profile?.skillsInterested || []} 
                         color="amber" 
                         targetUserId={user?.uid}
                         verifiedSkills={profile?.verifiedSkills}
                         endorsements={endorsements.filter(e => e.toUserId === user?.uid)}
                         onVerify={(s) => setVerifyingSkill(s)}
                       />
                     </div>
                  </section>
                </div>

                <aside className="lg:col-span-4 space-y-12">
                   <GamificationPanel profile={profile} />
                   <Leaderboard users={leaderboard} />
                </aside>
              </motion.div>
            )}

            {activeTab === 'ai-lab' && (
              <GapLab profile={profile} />
            )}

            {activeTab === 'admin' && profile?.isAdmin && (
              <motion.div 
                key="admin"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-20"
              >
                <div className="flex justify-between items-end bg-slate-900 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden group">
                  <Sparkles className="absolute -right-4 -bottom-4 w-48 h-48 text-white/5 opacity-20" />
                  <div>
                    <h2 className="text-5xl font-bold tracking-tighter italic font-serif">Governance</h2>
                    <p className="text-slate-400 mt-2 text-lg font-light">Seed enterprise entities or manage global taxonomy.</p>
                  </div>
                  <button 
                    onClick={async () => {
                      if (!confirm("Seed demo Learning Resources and Gigs?")) return;
                      const learningBatch = [
                        { title: "Generative AI for Leaders", description: "Strategic overview of LLMs in enterprise.", provider: "LinkedIn Learning", url: "https://learning.linkedin.com", skills: ["AI", "Leadership"], duration: "4h 30m", rating: 4.9, createdAt: serverTimestamp() },
                        { title: "Advanced React Patterns", description: "Master performance optimization.", provider: "Coursera", url: "https://coursera.org", skills: ["React", "JavaScript"], duration: "12h 00m", rating: 4.8, createdAt: serverTimestamp() },
                        { title: "Cloud Security Architecture", description: "Zero-trust principles for scalable systems.", provider: "Pluralsight", url: "https://pluralsight.com", skills: ["Security", "Cloud"], duration: "8h 15m", rating: 4.7, createdAt: serverTimestamp() },
                        { title: "Ethical Hacking: Pentesting", description: "Vulnerability analysis.", provider: "LinkedIn Learning", url: "https://linkedin.com", skills: ["Security"], duration: "6h 45m", rating: 4.9, createdAt: serverTimestamp() }
                      ];
                      const gigBatch = [
                        { title: "Internal Tools Refresh", description: "Migrate legacy dashboards.", department: "Engineering", skillsRequired: ["React", "Tailwind"], status: "Open", duration: "3 weeks", managerId: user?.uid, createdAt: serverTimestamp() },
                        { title: "Talent Mobility Research", description: "Find friction points.", department: "People Ops", skillsRequired: ["Research", "Strategy"], status: "Open", duration: "2 weeks", managerId: user?.uid, createdAt: serverTimestamp() }
                      ];
                      for (const res of learningBatch) await addDoc(collection(db, "resources"), res);
                      for (const gig of gigBatch) {
                        await addDoc(collection(db, "gigs"), { 
                          ...gig, 
                          postedBy: user?.uid,
                          status: 'open' // normalize to lowercase as per interface
                        });
                      }
                      alert("Seed deployed.");
                    }}
                    className="px-10 py-5 bg-white text-slate-900 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-all shadow-xl active:scale-95"
                  >
                    Seed Demo Data
                  </button>
                </div>
                <AdminSkillsManager skills={globalSkills} />
                <FeedbackBoard 
                  feedbacks={feedbacks} 
                  onTriggerOnboarding={() => setShowOnboarding(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Profile Modal */}
      <AnimatePresence>
        {isEditingProfile && (
          <ProfileModal 
            profile={profile} 
            onClose={() => setIsEditingProfile(false)} 
            onSave={async (data) => {
              if (!user) return;
              try {
                await updateDoc(doc(db, "users", user.uid), data);
                setProfile({ ...profile!, ...data });
                setIsEditingProfile(false);
              } catch (e) {
                handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Onboarding Flow */}
      <AnimatePresence>
        {showOnboarding && profile && (
          <OnboardingFlow 
            profile={profile}
            onComplete={async (data) => {
              if (!user) return;
              try {
                await updateDoc(doc(db, "users", user.uid), data);
                setProfile({ ...profile!, ...data });
                setShowOnboarding(false);
              } catch (e) {
                handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Public Profile Overlay */}
      <AnimatePresence>
        {viewingProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[3.5rem] p-12 max-w-3xl w-full shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-32 bg-slate-50 border-b border-slate-100 -z-10" />
              
              <button 
                onClick={() => setViewingProfile(null)}
                className="absolute top-10 right-10 p-2 text-slate-300 hover:text-slate-900 transition-colors"
                id="close-profile-overlay"
              >
                <X className="w-8 h-8" />
              </button>

              <div className="flex flex-col md:flex-row gap-10 mb-12">
                {viewingProfile.photoURL ? (
                  <img src={viewingProfile.photoURL} alt="" className="w-32 h-32 rounded-[2.5rem] border-8 border-white shadow-xl" />
                ) : (
                  <div className="w-32 h-32 rounded-[2.5rem] bg-slate-100 flex items-center justify-center text-slate-300 border-8 border-white shadow-xl">
                    <CircleUser className="w-16 h-16" />
                  </div>
                )}
                <div className="pt-4">
                  <h3 className="text-4xl font-bold tracking-tighter text-slate-900 mb-1">{viewingProfile.displayName}</h3>
                  <div className="text-blue-600 font-bold text-xl tracking-tight mb-4">{viewingProfile.title || 'Global Contributor'}</div>
                  <p className="text-slate-400 text-lg max-w-md italic leading-relaxed font-light">
                    "{viewingProfile.bio || 'Building the future of talent through collaboration and continuous growth.'}"
                  </p>
                  <div className="flex items-center gap-3 mt-6">
                    <div className="px-4 py-1.5 bg-slate-900 text-white rounded-full text-[10px] font-bold uppercase tracking-widest">
                      Level {viewingProfile.level || 1}
                    </div>
                    <div className="px-4 py-1.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                      <Trophy className="w-3.5 h-3.5" /> {viewingProfile.points || 0} Points
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <SkillPulseCard 
                  title="Verified Expertise" 
                  list={viewingProfile.skillsExpert} 
                  color="indigo"
                  targetUserId={viewingProfile.uid}
                  verifiedSkills={viewingProfile.verifiedSkills}
                  endorsements={endorsements.filter(e => e.toUserId === viewingProfile.uid)}
                  onEndorse={(skill) => handleEndorse(viewingProfile.uid, skill)}
                />
                <SkillPulseCard 
                  title="Growth Trajectory" 
                  list={viewingProfile.skillsInterested} 
                  color="amber"
                  targetUserId={viewingProfile.uid}
                  verifiedSkills={viewingProfile.verifiedSkills}
                  endorsements={endorsements.filter(e => e.toUserId === viewingProfile.uid)}
                  onEndorse={(skill) => handleEndorse(viewingProfile.uid, skill)}
                />
              </div>

              {assessments.filter(a => a.userId === viewingProfile.uid).length > 0 && (
                <div className="mt-12 space-y-6">
                  <h4 className="text-xl font-bold text-slate-900 px-2 italic font-serif flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-blue-600" />
                    Verified Credentials
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {assessments.filter(a => a.userId === viewingProfile.uid).map(a => (
                      <div key={a.id} className="bg-blue-50/30 p-6 rounded-[3rem] border border-blue-100 flex justify-between items-center group hover:bg-blue-50 transition-colors">
                        <div>
                          <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">{a.provider || 'Internal Evaluation'}</div>
                          <div className="text-lg font-bold text-slate-900">{a.skillName}</div>
                          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-1">
                            {new Date(a.verifiedAt?.toDate?.() || Date.now()).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-mono font-bold text-blue-600 tracking-tighter">{a.score}</div>
                          <div className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Score IQ</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {feedbacks.filter(f => f.mentorId === viewingProfile.uid).length > 0 && (
                <div className="mt-12 space-y-6">
                   <h4 className="text-xl font-bold text-slate-900 px-2 italic font-serif">Collaboration Reviews</h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {feedbacks.filter(f => f.mentorId === viewingProfile.uid).map(f => (
                        <div key={f.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 italic font-light text-slate-500 text-sm">
                           <div className="flex items-center gap-1 mb-3">
                              {[...Array(5)].map((_, i) => (
                                <Star 
                                  key={i} 
                                  className={`w-3 h-3 ${i < f.rating ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} 
                                />
                              ))}
                           </div>
                           "{f.comment}"
                        </div>
                      ))}
                   </div>
                </div>
              )}

              <div className="mt-12 flex justify-center">
                 <button 
                   onClick={() => setViewingProfile(null)}
                   className="px-10 py-4 font-bold text-slate-400 hover:text-slate-900 transition-colors"
                 >
                   Back to Network
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {verifyingSkill && (
          <AssessmentPortal 
            skill={verifyingSkill} 
            onClose={() => setVerifyingSkill(null)}
            onComplete={async (score) => {
              if (!user || !profile) return;
              try {
                const verifiedSkills = Array.from(new Set([...(profile.verifiedSkills || []), verifyingSkill]));
                await updateDoc(doc(db, "users", user.uid), { verifiedSkills });
                await addDoc(collection(db, "assessments"), {
                  userId: user.uid,
                  skillName: verifyingSkill,
                  score,
                  passed: score >= 80,
                  provider: "Pluralsight Role IQ",
                  verifiedAt: serverTimestamp()
                });
                setProfile({ ...profile, verifiedSkills });
                setVerifyingSkill(null);
                awardPoints(user.uid, 50, "Skill Explorer");
              } catch (e) {
                handleFirestoreError(e, OperationType.WRITE, "assessments");
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Subcomponents

function NavButton({ active, onClick, icon, label, mobile }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, mobile?: boolean }) {
  if (mobile) {
    return (
      <button 
        onClick={onClick}
        className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-bold ${
          active 
            ? "bg-slate-900 text-white shadow-xl shadow-slate-900/20" 
            : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
        }`}
      >
        {icon}
        <span className="text-lg">{label}</span>
      </button>
    );
  }

  return (
    <button 
      onClick={onClick}
      className={`px-5 py-2 rounded-xl transition-all flex items-center gap-2.5 text-sm font-bold tracking-tight ${
        active 
          ? "bg-white text-slate-900 shadow-sm border border-slate-200" 
          : "text-slate-500 hover:text-slate-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function PostCard({ post, onConnect, isOwn, onViewProfile, points, level }: { key?: any, post: MentorshipPost, onConnect: () => Promise<void> | void, isOwn: boolean, onViewProfile?: () => void, points?: number, level?: number }) {
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="glass-card rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-8 flex flex-col gap-6 group relative overflow-hidden"
    >
      <div className="flex justify-between items-start">
        <button 
          onClick={onViewProfile} 
          aria-label={`View ${post.userName}'s profile`}
          className="flex items-center gap-4 hover:opacity-80 transition-opacity text-left min-h-[44px]"
        >
          {post.userPhoto ? (
            <img src={post.userPhoto} alt={post.userName} className="w-12 h-12 rounded-2xl border border-slate-100 shadow-sm object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
              <CircleUser className="w-6 h-6 text-slate-300" />
            </div>
          )}
          <div>
            <div className="text-sm font-bold text-slate-900 leading-none">{post.userName}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">
              {new Date(post.createdAt?.toDate?.() || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            {points !== undefined && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                  Lvl {level || 1}
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded">
                  {points || 0} pts
                </span>
              </div>
            )}
          </div>
        </button>
        <div className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${
          post.type === 'offer' ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-purple-50 text-purple-600 border border-purple-100"
        }`}>
          {post.type === 'offer' ? "Providing" : "Seeking"}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight group-hover:text-blue-600 transition-colors">
          {post.skill}
        </h3>
        <p className="text-slate-500 text-sm leading-relaxed line-clamp-3 italic">
          "{post.description}"
        </p>
      </div>

      <div className="mt-auto pt-6 flex items-center justify-between border-t border-slate-50">
        <div className="flex items-center gap-2 text-slate-400">
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[10px] font-bold uppercase tracking-widest">Open Connection</span>
        </div>
        {!isOwn ? (
          <button 
            onClick={onConnect}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-full text-xs font-bold hover:bg-black transition-all shadow-lg shadow-slate-900/10 active:scale-95"
          >
            Connect
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <span className="text-xs text-slate-300 font-bold italic">Your Post</span>
        )}
      </div>
    </motion.div>
  );
}

function PairingCard({ pairing, currentUserId, onAwardPoints }: { key?: any, pairing: Pairing, currentUserId: string, onAwardPoints: (uid: string, points: number, badge?: string) => Promise<void> }) {
  const isMentor = pairing.mentorId === currentUserId;
  const partnerName = isMentor ? pairing.menteeName : pairing.mentorName;
  const [showFeedback, setShowFeedback] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  
  const updateProgress = async (val: number) => {
    try {
      const prevVal = pairing.progress || 0;
      await updateDoc(doc(db, "pairings", pairing.id), { progress: val });
      
      if (val === 100 && prevVal < 100) {
        await onAwardPoints(currentUserId, 100);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `pairings/${pairing.id}`);
    }
  };

  const toggleMilestone = async (index: number) => {
    if (!pairing.milestones) return;
    const newMilestones = [...pairing.milestones];
    const wasCompleted = newMilestones[index].completed;
    newMilestones[index] = { 
      ...newMilestones[index], 
      completed: !wasCompleted,
      completedAt: !wasCompleted ? Timestamp.now() : undefined
    };
    try {
      await updateDoc(doc(db, "pairings", pairing.id), { milestones: newMilestones });
      if (!wasCompleted) {
        await onAwardPoints(currentUserId, 25);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `pairings/${pairing.id}`);
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 transition-all hover:shadow-xl hover:shadow-slate-200/20 hover:-translate-y-1 group flex flex-col gap-6">
      <div className="flex items-center gap-5">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-slate-50 shadow-sm ${
          isMentor ? "bg-indigo-50 text-indigo-500" : "bg-blue-50 text-blue-500"
        }`}>
          {isMentor ? <Target className="w-7 h-7" /> : <GraduationCap className="w-7 h-7" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-slate-900 truncate">{partnerName}</span>
            <span className={`text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border ${
              pairing.status === 'active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
            }`}>
              {pairing.status}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Growth Focus: <span className="text-slate-900 font-bold italic">{pairing.skill}</span></div>
        </div>
        <div className="flex flex-col items-end">
           <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Mastery</div>
           <div className="text-xl font-serif italic text-slate-900">{pairing.progress || 0}%</div>
        </div>
      </div>

      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${pairing.progress || 0}%` }}
          className="h-full bg-slate-900"
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-2">
          {!isMentor && pairing.status === 'active' && (
            <button 
              onClick={() => setShowFeedback(true)}
              className="px-4 py-2 bg-slate-50 text-slate-600 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-slate-100 flex items-center gap-2 transition-colors border border-transparent hover:border-slate-200"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Session Review
            </button>
          )}
          <button 
            onClick={() => setShowMilestones(!showMilestones)}
            className="px-4 py-2 bg-slate-50 text-slate-600 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-slate-100 flex items-center gap-2 transition-colors border border-transparent hover:border-slate-200"
          >
            <Clock className="w-3.5 h-3.5" /> Milestones
          </button>
        </div>
        
        {isMentor && (
          <select 
            value={pairing.progress || 0}
            onChange={(e) => updateProgress(Number(e.target.value))}
            className="text-[10px] font-bold uppercase tracking-widest bg-white border border-gray-100 rounded-lg py-1 px-2 focus:outline-none"
          >
            {[0, 25, 50, 75, 100].map(v => <option key={v} value={v}>{v}%</option>)}
          </select>
        )}
      </div>

      <AnimatePresence>
        {showMilestones && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-2 pt-2 border-t border-gray-50 mt-2"
          >
            {(pairing.milestones || []).map((m, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className={`transition-colors ${m.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{m.title}</span>
                {isMentor ? (
                  <button onClick={() => toggleMilestone(i)}>
                    <CheckCircle2 className={`w-4 h-4 transition-colors ${m.completed ? 'text-green-500' : 'text-gray-200 hover:text-green-300'}`} />
                  </button>
                ) : (
                  <CheckCircle2 className={`w-4 h-4 ${m.completed ? 'text-green-500' : 'text-gray-200'}`} />
                )}
              </div>
            ))}
            {isMentor && (
              <button 
                onClick={async () => {
                  const title = prompt("Milestone goal:");
                  if (title) {
                    const newM = [...(pairing.milestones || []), { title, completed: false }];
                    await updateDoc(doc(db, "pairings", pairing.id), { milestones: newM });
                  }
                }}
                className="w-full py-2 border-2 border-dashed border-gray-100 rounded-xl text-[10px] text-gray-400 font-bold uppercase hover:border-gray-200 hover:text-gray-600 transition-all"
              >
                + Add Milestone
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showFeedback && (
          <FeedbackModal 
            pairingId={pairing.id} 
            mentorId={pairing.mentorId}
            onClose={() => setShowFeedback(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FeedbackModal({ pairingId, mentorId, onClose }: { pairingId: string, mentorId: string, onClose: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const u = auth.currentUser;
    if (!u) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "feedback"), {
        pairingId,
        mentorId,
        menteeId: u.uid,
        rating,
        comment,
        createdAt: serverTimestamp()
      });
      alert("Feedback submitted!");
      onClose();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, "feedback");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl"
      >
        <h3 className="text-xl font-bold mb-1">Session Feedback</h3>
        <p className="text-xs text-gray-400 mb-6">How was your session with your mentor?</p>
        
        <div className="space-y-6">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map(v => (
              <button 
                key={v} 
                onClick={() => setRating(v)}
                className={`p-2 transition-colors ${rating >= v ? 'text-yellow-400' : 'text-gray-100'}`}
              >
                <Star className="w-8 h-8 fill-current" />
              </button>
            ))}
          </div>

          <textarea 
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Any specific takeaways?"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm h-24 resize-none"
          />

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-gray-400">Cancel</button>
            <button 
              onClick={handleSubmit} 
              disabled={submitting}
              className="flex-1 py-3 bg-[var(--color-brand)] text-white rounded-xl text-sm font-bold disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Submit"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Leaderboard({ users }: { users: UserProfile[] }) {
  return (
    <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-[0_8px_40px_rgb(0,0,0,0.02)]">
      <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-500" /> Talent Leaderboard
      </h4>
      <div className="space-y-4">
        {users.map((u, i) => (
          <div key={u.uid} className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${i === 0 ? 'bg-amber-100 text-amber-600' : 'text-slate-300'}`}>
                {i + 1}
              </span>
              {u.photoURL ? (
                <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full border border-slate-100" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                  <CircleUser className="w-5 h-5 text-slate-300" />
                </div>
              )}
              <div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">{u.displayName}</div>
                <div className="text-[9px] text-slate-400 font-medium">Lvl {u.level || 1}</div>
              </div>
            </div>
            <div className="text-xs font-serif italic text-slate-900">{u.points || 0} pts</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GamificationPanel({ profile }: { profile: UserProfile | null }) {
  if (!profile) return null;
  
  const nextLevelPoints = (profile.level || 1) * 100;
  const currentLevelProgress = ((profile.points || 0) % 100);

  return (
    <div className="space-y-8">
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">Career Status</div>
              <div className="text-4xl font-bold tracking-tighter">Level {profile.level || 1}</div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
               <Award className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          
          <div className="space-y-2 mb-6">
             <div className="flex justify-between text-[10px] font-bold">
                <span className="text-slate-400 uppercase tracking-widest">Points</span>
                <span>{profile.points || 0} / {nextLevelPoints}</span>
             </div>
             <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${currentLevelProgress}%` }}
                  className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                />
             </div>
          </div>

          <div>
             <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">Recent Badges</div>
             <div className="flex flex-wrap gap-2">
                {(profile.badges || []).length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No badges earned yet.</div>
                ) : (
                  profile.badges?.map(b => (
                    <div key={b} className="group relative">
                      <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold hover:bg-white/10 transition-colors flex items-center gap-1.5 cursor-help">
                        <Star className="w-3 h-3 text-amber-400 fill-current" />
                        {b}
                      </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkillPulseCard({ 
  title, 
  list, 
  color, 
  targetUserId, 
  verifiedSkills = [],
  endorsements = [], 
  onEndorse,
  onVerify
}: { 
  title: string, 
  list: any[], 
  color: string, 
  targetUserId?: string,
  verifiedSkills?: string[],
  endorsements?: Endorsement[],
  onEndorse?: (skill: string) => void,
  onVerify?: (skill: string) => void
}) {
  const currentUserId = auth.currentUser?.uid;
  const themeColor = color === 'indigo' ? 'bg-indigo-500' : 'bg-amber-500';

  return (
    <div className={`p-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col gap-6`}>
      <h5 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
        <div className={`w-1 h-1 rounded-full ${themeColor}`} />
        {title}
      </h5>
      <div className="flex flex-wrap gap-3">
        {list.length === 0 ? (
          <span className="text-xs font-serif italic text-slate-300">No profile pulse detected</span>
        ) : (
          list.map((s, i) => {
            const skillName = typeof s === 'string' ? s : s.name;
            const skillEndorsements = endorsements.filter(e => e.skillName === skillName);
            const userHasEndorsed = skillEndorsements.some(e => e.fromUserId === currentUserId);
            const isVerified = (verifiedSkills || []).includes(skillName);
            
            return (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex items-center gap-2 bg-slate-50/50 border border-slate-100 pl-4 pr-2 py-2 rounded-2xl group hover:border-slate-300 transition-all relative">
                  {isVerified && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white z-10">
                      <ShieldCheck className="w-3 h-3" />
                    </div>
                  )}
                  <span className={`text-sm font-bold ${isVerified ? 'text-blue-900 font-serif italic' : 'text-slate-700'}`}>
                    {skillName}
                  </span>
                  
                  {targetUserId && targetUserId !== currentUserId && onEndorse && (
                    <button 
                      onClick={() => onEndorse(skillName)}
                      disabled={userHasEndorsed}
                      className={`p-1 rounded-lg transition-all ${
                        userHasEndorsed 
                          ? "text-emerald-500 bg-emerald-50" 
                          : "text-slate-300 hover:text-blue-600 hover:bg-white"
                      }`}
                      title={userHasEndorsed ? "You endorsed this skill" : "Endorse skill"}
                    >
                      <Trophy className={`w-3 h-3 ${userHasEndorsed ? 'fill-current' : ''}`} />
                    </button>
                  )}

                  {targetUserId === currentUserId && !isVerified && onVerify && (
                    <button 
                      onClick={() => onVerify(skillName)}
                      className="p-1 text-slate-300 hover:text-blue-600 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Verify via Pluralsight Role IQ"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-1">
                  <span className="text-[9px] text-slate-400 font-serif italic">
                    {typeof s === 'object' ? (s.level || s.targetLevel || '') : ''}
                  </span>
                  {skillEndorsements.length > 0 && (
                    <div className="flex items-center gap-0.5 text-[9px] font-bold text-amber-500">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      {skillEndorsements.length}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function PostCreator({ onPost }: { onPost: (t: 'request' | 'offer', s: string, d: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<'request' | 'offer'>('request');
  const [skill, setSkill] = useState("");
  const [desc, setDesc] = useState("");

  if (!isOpen) return (
    <button 
      onClick={() => setIsOpen(true)}
      className="flex items-center gap-3 px-8 py-3 bg-slate-900 text-white rounded-full font-bold text-sm shadow-xl shadow-slate-900/20 hover:scale-105 transition-all"
    >
      <Plus className="w-5 h-5" /> Opportunity
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ y: 30, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        className="bg-white rounded-[2.5rem] sm:rounded-[3rem] p-8 sm:p-10 max-w-md w-full shadow-2xl space-y-8 overflow-y-auto max-h-[90vh]"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-3xl font-bold tracking-tight text-slate-900 leading-none">Exchange</h3>
          <button onClick={() => setIsOpen(false)} aria-label="Close modal" className="p-2 -mr-2 text-slate-300 hover:text-slate-900"><X className="w-6 h-6" /></button>
        </div>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl">
             <button 
               onClick={() => setType('request')}
               className={`py-3 rounded-xl text-xs font-bold transition-all ${type === 'request' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
             >
               Seeking Mentor
             </button>
             <button 
               onClick={() => setType('offer')}
               className={`py-3 rounded-xl text-xs font-bold transition-all ${type === 'offer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
             >
               Willing to Mentor
             </button>
          </div>

          <div className="space-y-2">
             <label htmlFor="target-skill" className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Target Skill</label>
             <input 
               id="target-skill"
               value={skill}
               onChange={e => setSkill(e.target.value)}
               placeholder="e.g. Distributed Systems, Golang..."
               className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
             />
          </div>

          <div className="space-y-2">
             <label htmlFor="notes" className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Notes</label>
             <textarea 
               id="notes"
               value={desc}
               onChange={e => setDesc(e.target.value)}
               placeholder="Tell us what you're looking for or your experience level..."
               className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm h-24 resize-none"
             />
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              onClick={() => setIsOpen(false)}
              className="flex-1 py-3.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                if (skill && desc) {
                  onPost(type, skill, desc);
                  setIsOpen(false);
                }
              }}
              className="flex-[2] py-3.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-black/10 hover:bg-black transition-all active:scale-95"
            >
              Share Opportunity
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ProfileModal({ profile, onClose, onSave }: { profile: UserProfile | null, onClose: () => void, onSave: (data: any) => void }) {
  const [formData, setFormData] = useState({
    displayName: profile?.displayName || "",
    title: profile?.title || "",
    department: profile?.department || "",
    bio: profile?.bio || "",
    aspirations: profile?.aspirations || "",
  });

  const [expertSkills, setExpertSkills] = useState<UserSkillExpert[]>(profile?.skillsExpert || []);
  const [interestedSkills, setInterestedSkills] = useState<UserSkillInterested[]>(profile?.skillsInterested || []);

  const levels: ProficiencyLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

  const addExpertSkill = () => setExpertSkills([...expertSkills, { name: "", level: 'Intermediate' }]);
  const addInterestedSkill = () => setInterestedSkills([...interestedSkills, { name: "", targetLevel: 'Advanced' }]);

  const updateExpert = (i: number, field: keyof UserSkillExpert, val: string) => {
    const next = [...expertSkills];
    next[i] = { ...next[i], [field]: val };
    setExpertSkills(next);
  };

  const updateInterested = (i: number, field: keyof UserSkillInterested, val: string) => {
    const next = [...interestedSkills];
    next[i] = { ...next[i], [field]: val };
    setInterestedSkills(next);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[2rem] md:rounded-[3rem] max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl border border-white/20"
      >
        <div className="p-6 md:p-8 pb-4 shrink-0 flex items-center justify-between">
           <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Professional Identity</h2>
           <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-0 space-y-6">
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Full Name</label>
                <input 
                  value={formData.displayName} 
                  onChange={e => setFormData({...formData, displayName: e.target.value})}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Official Role</label>
                <input 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g. Technical Lead"
                  className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" 
                />
              </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Department</label>
                <input 
                  value={formData.department} 
                  onChange={e => setFormData({...formData, department: e.target.value})}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-accent)] ml-1">Career Goal (Target Role)</label>
                <input 
                  value={formData.aspirations} 
                  onChange={e => setFormData({...formData, aspirations: e.target.value})}
                  placeholder="e.g. Engineering Director"
                  className="w-full mt-1 px-4 py-3 bg-blue-50/50 rounded-xl border border-blue-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium" 
                />
              </div>
           </div>

           <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Bio / Journey</label>
              <textarea 
                value={formData.bio} 
                onChange={e => setFormData({...formData, bio: e.target.value})}
                placeholder="Tell us about your career path..."
                className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 h-20 resize-none" 
              />
           </div>

           <div className="space-y-4">
              <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">I can mentor in...</label>
                  <button onClick={addExpertSkill} className="text-[10px] font-bold text-indigo-600 hover:underline">+ Add Skill</button>
                </div>
                <div className="space-y-2">
                  {expertSkills.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <input 
                        value={s.name}
                        onChange={e => updateExpert(i, 'name', e.target.value)}
                        placeholder="Skill name"
                        className="flex-1 bg-white px-3 py-2 rounded-lg border border-indigo-100 text-xs"
                      />
                      <select 
                        value={s.level}
                        onChange={e => updateExpert(i, 'level', e.target.value)}
                        className="bg-white px-2 py-2 rounded-lg border border-indigo-100 text-xs"
                      >
                        {levels.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <button onClick={() => setExpertSkills(expertSkills.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400">×</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-100">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-amber-600">I want to acquire...</label>
                  <button onClick={addInterestedSkill} className="text-[10px] font-bold text-amber-600 hover:underline">+ Add Skill</button>
                </div>
                <div className="space-y-2">
                  {interestedSkills.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <input 
                        value={s.name}
                        onChange={e => updateInterested(i, 'name', e.target.value)}
                        placeholder="Skill name"
                        className="flex-1 bg-white px-3 py-2 rounded-lg border border-amber-100 text-xs"
                      />
                      <select 
                        value={s.targetLevel}
                        onChange={e => updateInterested(i, 'targetLevel', e.target.value)}
                        className="bg-white px-2 py-2 rounded-lg border border-amber-100 text-xs"
                      >
                        {levels.slice(1).map(l => <option key={l} value={l}>Target: {l}</option>)}
                      </select>
                      <button onClick={() => setInterestedSkills(interestedSkills.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400">×</button>
                    </div>
                  ))}
                </div>
              </div>
           </div>
        </div>

        <div className="p-6 md:p-8 border-t border-gray-100 shrink-0 flex gap-4">
           <button onClick={onClose} className="px-6 py-3 border border-gray-200 rounded-xl font-bold text-gray-400 hover:bg-gray-50 flex-1 text-sm">Discard</button>
           <button 
             onClick={() => onSave({
               ...formData,
               skillsExpert: expertSkills.filter(s => s.name),
               skillsInterested: interestedSkills.filter(s => s.name),
               isMentor: expertSkills.length > 0
             })}
             className="px-6 py-3 bg-[var(--color-brand)] text-white rounded-xl font-bold shadow-xl shadow-black/10 hover:opacity-90 flex-[2] text-sm"
           >
             Lock in Profile
           </button>
        </div>
      </motion.div>
    </div>
  );
}

function GapLab({ profile }: { profile: UserProfile | null }) {
  const [targetRole, setTargetRole] = useState(profile?.aspirations || "");
  const [analysis, setAnalysis] = useState<any>(null);
  const [mentors, setMentors] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMentors, setActiveMentors] = useState<UserProfile[]>([]);

  useEffect(() => {
    const q = query(collection(db, "users"), where("isMentor", "==", true));
    return onSnapshot(q, (snap) => {
      setActiveMentors(snap.docs.map(d => d.data() as UserProfile).filter(m => m.uid !== profile?.uid));
    });
  }, [profile?.uid]);

  const runAnalysis = async () => {
    if (!targetRole || !profile) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const allSkills = [...profile.skillsExpert, ...profile.skillsInterested];
      if (allSkills.length === 0) {
        setError("Your profile lacks skills. Please add expert or interested skills in your profile first.");
        setIsAnalyzing(false);
        return;
      }
      const res = await getSkillGapAnalyses(allSkills, targetRole, profile.bio);
      if (!res.gaps || res.gaps.length === 0) {
        throw new Error("No specific gaps identified. Try a more focused target role.");
      }
      setAnalysis(res);
      
      const recs = await getMentorRecommendations(profile, activeMentors);
      setMentors(recs.recommendations || []);
    } catch (e) {
      console.error(e);
      setError("AI Analysis encountered an issue. Please try again with a different role description.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-16 max-w-5xl">
       <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-[0_8px_40px_rgb(0,0,0,0.03)] overflow-hidden relative">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
             <TrendingUp className="w-64 h-64 text-blue-600" />
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] mb-8">
              <Sparkles className="w-3.5 h-3.5" /> Strategic Intelligence
            </div>
            <h2 className="text-5xl font-bold tracking-tighter mb-6 italic font-serif text-slate-900 leading-tight">Simulate your professional future.</h2>
            <p className="text-slate-400 max-w-xl text-xl leading-relaxed mb-12 font-light">Our engine analyzes global industry trends and maps them against your talent profile to reveal the hidden bridges to your next role.</p>
            
            <div className="flex flex-col sm:flex-row gap-4">
               <div className="flex-1 relative">
                 <Target className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                 <input 
                   value={targetRole}
                   onChange={e => setTargetRole(e.target.value)}
                   placeholder="Your next milestone (e.g. VP of Engineering)"
                   className="w-full pl-16 pr-8 py-6 bg-slate-50 border border-slate-100 rounded-[2.5rem] focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500 transition-all font-bold text-xl placeholder:font-normal placeholder:text-slate-300 text-slate-900"
                 />
               </div>
               <button 
                 onClick={runAnalysis}
                 disabled={isAnalyzing || !targetRole}
                 className="px-12 py-6 bg-slate-900 text-white rounded-[2.5rem] font-bold flex items-center justify-center gap-4 hover:bg-black transition-all disabled:opacity-50 shadow-2xl shadow-slate-900/20 active:scale-95"
               >
                 {isAnalyzing ? (
                   <>
                     <Sparkles className="w-6 h-6 animate-spin" />
                     Processing...
                   </>
                 ) : (
                   <>
                     Map My Gap
                     <ArrowRight className="w-6 h-6" />
                   </>
                 )}
               </button>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 p-4 bg-rose-50 text-rose-600 rounded-2xl text-sm font-medium flex items-center gap-3"
                >
                  <X className="w-4 h-4 cursor-pointer" onClick={() => setError(null)} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
       </div>

       {isAnalyzing && !analysis && (
         <div className="py-20 flex flex-col items-center gap-6">
            <motion.div 
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [0.3, 1, 0.3]
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-500"
            >
              <Map className="w-10 h-10" />
            </motion.div>
            <p className="text-slate-400 font-serif italic text-lg">Crunching enterprise data and talent maps...</p>
         </div>
       )}

       {analysis && (
         <div className="space-y-12">
            <section className="space-y-6">
              <h3 className="text-2xl font-bold flex items-center gap-3"><Map className="w-6 h-6 text-blue-500" /> Strategic Gap Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {analysis.gaps.map((gap: any, i: number) => (
                   <motion.div 
                     key={gap.skill}
                     initial={{ y: 20, opacity: 0 }}
                     animate={{ y: 0, opacity: 1 }}
                     transition={{ delay: i * 0.1 }}
                     className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col gap-5 hover:border-blue-200 transition-colors"
                   >
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-serif italic text-xl">
                        {i + 1}
                      </div>
                      <h4 className="text-xl font-bold text-gray-900 leading-tight">{gap.skill}</h4>
                      <p className="text-sm text-gray-500 leading-relaxed italic border-l-2 border-gray-100 pl-4">{gap.reason}</p>
                      <div className="space-y-3 mt-2">
                         {gap.steps.map((step: string, j: number) => (
                            <div key={j} className="flex gap-3 items-start">
                               <CheckCircle2 className="mt-1 w-4 h-4 text-green-400 shrink-0" />
                               <span className="text-xs text-gray-600 font-medium">{step}</span>
                            </div>
                         ))}
                      </div>
                   </motion.div>
                 ))}
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <section className="space-y-6">
                  <h3 className="text-2xl font-bold flex items-center gap-3"><TrendingUp className="w-6 h-6 text-amber-500" /> Trending In Enterprise</h3>
                  <div className="space-y-4">
                    {analysis.trending?.map((item: any, i: number) => (
                      <div key={i} className="p-6 bg-amber-50/30 rounded-3xl border border-amber-100 flex gap-4">
                        <div className="text-2xl">🚀</div>
                        <div>
                          <div className="font-bold text-amber-900">{item.skill}</div>
                          <div className="text-xs text-amber-700/70 mt-1">{item.why}</div>
                        </div>
                      </div>
                    ))}
                  </div>
               </section>

               <section className="space-y-6">
                  <h3 className="text-2xl font-bold flex items-center gap-3"><Users className="w-6 h-6 text-indigo-500" /> AI Mentor Matching</h3>
                  <div className="space-y-4">
                    {mentors.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-3xl italic">
                        No optimal matches found in current active mentor pool.
                      </div>
                    ) : (
                      mentors.map((rec: any, i: number) => {
                        const mentor = activeMentors.find(m => m.uid === rec.mentorUid);
                        if (!mentor) return null;
                        return (
                          <div key={i} className="p-6 bg-white border border-gray-100 rounded-3xl flex items-center gap-4 hover:border-indigo-200 transition-colors cursor-pointer group">
                             {mentor.photoURL ? (
                               <img src={mentor.photoURL} className="w-14 h-14 rounded-2xl" />
                             ) : (
                               <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-400">
                                 <CircleUser className="w-8 h-8" />
                               </div>
                             )}
                             <div className="flex-1">
                               <div className="font-bold text-gray-900">{mentor.displayName}</div>
                               <div className="text-xs text-[var(--color-accent)] font-medium mb-1">{mentor.title}</div>
                               <div className="text-[10px] text-gray-400 leading-snug group-hover:text-gray-600 transition-colors">"{rec.reason}"</div>
                             </div>
                             <ArrowRight className="w-5 h-5 text-gray-200 group-hover:text-indigo-500 transition-colors" />
                          </div>
                        );
                      })
                    )}
                  </div>
               </section>
            </div>
         </div>
       )}
    </div>
  );
}

function FeedbackBoard({ feedbacks, onTriggerOnboarding }: { feedbacks: SessionFeedback[], onTriggerOnboarding?: () => void }) {
  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-32">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold tracking-tighter text-slate-900 italic font-serif uppercase">System Insights</h2>
          <p className="text-slate-400 mt-2 font-medium">Monitoring the pulse of mentorship collaboration.</p>
        </div>
        <div className="flex items-center gap-4">
          {onTriggerOnboarding && (
            <button 
              onClick={onTriggerOnboarding}
              className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs uppercase tracking-widest border border-blue-100 hover:bg-blue-100 transition-colors"
            >
              Test Onboarding
            </button>
          )}
          <div className="px-6 py-2 bg-slate-100 text-slate-900 rounded-full font-bold text-xs uppercase tracking-widest border border-slate-200">
            {feedbacks.length} Reviews logged
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {feedbacks.map(f => (
          <div key={f.id} className="bg-white p-10 rounded-[3rem] border border-slate-50 shadow-sm hover:shadow-xl transition-all group">
            <div className="flex items-center gap-1 mb-6">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  className={`w-4 h-4 ${i < (f.rating || 0) ? "text-amber-400 fill-amber-400" : "text-slate-100"}`} 
                />
              ))}
            </div>
            <p className="text-lg text-slate-600 italic font-light leading-relaxed mb-8">"{f.comment}"</p>
            <div className="flex items-center justify-between pt-8 border-t border-slate-50">
               <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Mentor Reference</span>
                  <span className="text-sm font-mono text-slate-400 group-hover:text-slate-900 transition-colors uppercase">{f.mentorId.slice(0, 8)}</span>
               </div>
               <div className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                  {f.createdAt instanceof Timestamp ? f.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : "Recently"}
               </div>
            </div>
          </div>
        ))}
        {feedbacks.length === 0 && (
          <div className="col-span-full py-32 bg-slate-50 rounded-[4rem] border-2 border-dashed border-slate-200 flex flex-col items-center">
             <MessageSquare className="w-12 h-12 text-slate-200 mb-4" />
             <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No feedback yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminSkillsManager({ skills }: { skills: GlobalSkill[] }) {
  const [isEditing, setIsEditing] = useState<GlobalSkill | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this skill?")) {
      try {
        await deleteDoc(doc(db, "skills", id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `skills/${id}`);
      }
    }
  };

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-bold tracking-tighter text-slate-900 italic font-serif uppercase">Global Competencies</h2>
          <p className="text-slate-400 mt-2 font-medium">Enterprise skill directory governance for Arvind.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="px-8 py-4 bg-slate-900 text-white rounded-full font-bold flex items-center gap-3 hover:bg-black transition-all shadow-xl shadow-slate-900/10 active:scale-95 shrink-0"
        >
          <Plus className="w-5 h-5" /> Add New Skill
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {skills.map(skill => (
          <div key={skill.id} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-blue-100 transition-all group relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10">
                <button 
                  onClick={() => setIsEditing(skill)}
                  className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition-colors shadow-sm"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(skill.id)}
                  className="p-3 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-colors shadow-sm"
                >
                  <X className="w-4 h-4" />
                </button>
             </div>
             
             <div className="inline-flex px-4 py-1.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] mb-6">
               {skill.category}
             </div>
             <h3 className="text-2xl font-bold text-slate-900 mb-3 truncate pr-20">{skill.name}</h3>
             <p className="text-sm text-slate-400 leading-relaxed line-clamp-3 italic font-light">
               {skill.description || "No description provided for this Arvind enterprise competency."}
             </p>
          </div>
        ))}
        {skills.length === 0 && (
          <div className="col-span-full py-32 bg-slate-50 rounded-[4rem] border-2 border-dashed border-slate-200 flex flex-col items-center">
             <ShieldCheck className="w-12 h-12 text-slate-200 mb-4" />
             <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Catalog empty</p>
             <button onClick={() => setIsAdding(true)} className="mt-4 text-blue-500 font-bold hover:underline">Register first skill →</button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {(isAdding || isEditing) && (
          <SkillEditor 
            skill={isEditing} 
            onClose={() => { setIsAdding(false); setIsEditing(null); }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SkillEditor({ skill, onClose }: { skill: GlobalSkill | null, onClose: () => void }) {
  const [name, setName] = useState(skill?.name || "");
  const [category, setCategory] = useState(skill?.category || "Technical");
  const [description, setDescription] = useState(skill?.description || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const data = {
        name,
        category,
        description,
        createdAt: skill ? skill.createdAt : serverTimestamp()
      };

      if (skill) {
        await updateDoc(doc(db, "skills", skill.id), data);
      } else {
        await addDoc(collection(db, "skills"), data);
      }
      onClose();
    } catch (err) {
      handleFirestoreError(err, skill ? OperationType.UPDATE : OperationType.CREATE, "skills");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
       <motion.div 
         initial={{ scale: 0.9, opacity: 0, y: 20 }}
         animate={{ scale: 1, opacity: 1, y: 0 }}
         exit={{ scale: 0.9, opacity: 0, y: 20 }}
         className="bg-white rounded-[3.5rem] p-12 max-w-xl w-full shadow-2xl relative overflow-hidden"
       >
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-slate-50 rounded-full blur-3xl opacity-50" />
          
          <button onClick={onClose} className="absolute top-10 right-10 p-2 text-slate-300 hover:text-slate-900 transition-colors z-20">
            <X className="w-8 h-8" />
          </button>
          
          <div className="relative z-10">
            <h3 className="text-4xl font-bold tracking-tighter mb-2 italic font-serif uppercase">{skill ? "Edit Concept" : "Add Competency"}</h3>
            <p className="text-slate-400 mb-10 text-lg font-medium">Standardize the Arvind knowledge landscape.</p>
            
            <form onSubmit={handleSave} className="space-y-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Skill Name</label>
                  <input 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-10 py-6 bg-slate-50 border border-slate-100 rounded-[2.5rem] focus:outline-none focus:ring-8 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500 transition-all font-bold text-xl"
                    required
                    placeholder="e.g. Adaptive Leadership"
                  />
               </div>
               
               <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Category</label>
                  <div className="relative">
                    <select 
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full px-10 py-6 bg-slate-50 border border-slate-100 rounded-[2.5rem] focus:outline-none focus:ring-8 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500 transition-all font-bold text-xl appearance-none"
                    >
                      <option value="Technical">Technical</option>
                      <option value="Soft Skills">Soft Skills</option>
                      <option value="Leadership">Leadership</option>
                      <option value="Business">Business</option>
                      <option value="Creative">Creative</option>
                    </select>
                    <ChevronRight className="absolute right-8 top-1/2 -translate-y-1/2 rotate-90 w-6 h-6 text-slate-300 pointer-events-none" />
                  </div>
               </div>
               
               <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Enterprise Definition</label>
                  <textarea 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full px-10 py-6 bg-slate-50 border border-slate-100 rounded-[2.5rem] focus:outline-none focus:ring-8 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500 transition-all font-medium text-sm h-36 resize-none italic leading-relaxed"
                    placeholder="Describe how this skill applies to our enterprise goals..."
                  />
               </div>
               
               <button 
                 type="submit"
                 disabled={isSaving}
                 className="w-full py-7 bg-slate-900 text-white rounded-[3rem] font-bold text-2xl hover:bg-black transition-all disabled:opacity-50 shadow-2xl shadow-slate-900/20 mt-6 active:scale-95"
               >
                 {isSaving ? "Syncing..." : "Commit to Registry"}
               </button>
            </form>
          </div>
       </motion.div>
    </div>
  );
}

function OnboardingFlow({ profile, onComplete }: { profile: UserProfile, onComplete: (data: any) => void }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    displayName: profile.displayName || "",
    title: profile.title || "",
    department: profile.department || "Technology",
    bio: profile.bio || "",
  });
  const [expertSkills, setExpertSkills] = useState<UserSkillExpert[]>(profile.skillsExpert || []);
  const [interestedSkills, setInterestedSkills] = useState<UserSkillInterested[]>(profile.skillsInterested || []);

  const totalSteps = 4;

  const nextStep = () => {
    if (step < totalSteps) setStep(step + 1);
    else handleComplete();
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleComplete = () => {
    onComplete({
      ...formData,
      skillsExpert: expertSkills.filter(s => s.name),
      skillsInterested: interestedSkills.filter(s => s.name),
      isMentor: expertSkills.length > 0
    });
  };

  const levels: ProficiencyLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

  const canContinue = () => {
    if (step === 2) return formData.displayName && formData.title;
    if (step === 4) return interestedSkills.some(s => s.name);
    return true;
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-[3.5rem] max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-slate-100 flex">
          {[...Array(totalSteps)].map((_, i) => (
            <div 
              key={i} 
              className={`h-full transition-all duration-500 ${i < step ? "bg-blue-500" : "bg-transparent"}`}
              style={{ width: `${100/totalSteps}%` }}
            />
          ))}
        </div>

        <div className="p-12 md:p-16 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8 text-center"
              >
                <div className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center mx-auto text-blue-500 shadow-xl shadow-blue-500/10">
                  <Sparkles className="w-10 h-10" />
                </div>
                <div className="space-y-4">
                  <h2 className="text-4xl font-bold tracking-tight text-slate-900 italic font-serif uppercase leading-tight">Welcome to the Exchange</h2>
                  <p className="text-slate-500 text-lg leading-relaxed">Let's build your professional identity and unlock the power of mentorship at Arvind.</p>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-slate-900">Personal Details</h2>
                  <p className="text-slate-400">How should colleagues see you in the network?</p>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Display Name</label>
                    <input 
                      value={formData.displayName}
                      onChange={e => setFormData({...formData, displayName: e.target.value})}
                      className="w-full mt-2 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-medium"
                      placeholder="Your name"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Current Title</label>
                      <input 
                        value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                        className="w-full mt-2 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-medium text-sm"
                        placeholder="e.g. Lead Engineer"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Department</label>
                      <select 
                        value={formData.department}
                        onChange={e => setFormData({...formData, department: e.target.value})}
                        className="w-full mt-2 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-medium text-sm appearance-none"
                      >
                        <option value="Technology">Technology</option>
                        <option value="Product">Product</option>
                        <option value="Design">Design</option>
                        <option value="HR">HR</option>
                        <option value="Operations">Operations</option>
                        <option value="Marketing">Marketing</option>
                      </select>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-slate-900 font-serif italic">Your Strengths</h2>
                  <p className="text-slate-400">What skills have you mastered that you could share?</p>
                </div>
                <div className="space-y-4">
                  {expertSkills.map((s, i) => (
                    <div key={i} className="flex gap-2 group">
                      <input 
                        value={s.name}
                        onChange={e => {
                          const next = [...expertSkills];
                          next[i].name = e.target.value;
                          setExpertSkills(next);
                        }}
                        placeholder="Skill Name"
                        className="flex-1 px-4 py-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-sm italic font-light focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <select 
                        value={s.level}
                        onChange={e => {
                          const next = [...expertSkills];
                          next[i].level = e.target.value as ProficiencyLevel;
                          setExpertSkills(next);
                        }}
                        className="px-3 py-3 bg-white border border-indigo-100 rounded-xl text-xs font-bold uppercase tracking-tight"
                      >
                        {levels.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <button onClick={() => setExpertSkills(expertSkills.filter((_, idx) => idx !== i))} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                        <Plus className="w-5 h-5 rotate-45" />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => setExpertSkills([...expertSkills, { name: "", level: 'Intermediate' }])}
                    className="w-full py-4 border-2 border-dashed border-indigo-100 rounded-2xl text-indigo-500 flex items-center justify-center gap-2 hover:bg-indigo-50/50 transition-all font-bold text-xs uppercase tracking-widest"
                  >
                    <Plus className="w-4 h-4" />
                    Add Expertise
                  </button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-slate-900">Growth Path</h2>
                  <p className="text-slate-400">What's the one skill you most want to focus on next?</p>
                </div>
                <div className="space-y-4">
                  {interestedSkills.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <input 
                        value={s.name}
                        onChange={e => {
                          const next = [...interestedSkills];
                          next[i].name = e.target.value;
                          setInterestedSkills(next);
                        }}
                        placeholder="Target Skill"
                        className="flex-1 px-4 py-3 bg-amber-50/50 border border-amber-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                      <select 
                        value={s.targetLevel}
                        onChange={e => {
                          const next = [...interestedSkills];
                          next[i].targetLevel = e.target.value as ProficiencyLevel;
                          setInterestedSkills(next);
                        }}
                        className="px-3 py-3 bg-white border border-amber-100 rounded-xl text-xs font-bold uppercase tracking-tight"
                      >
                        {levels.slice(1).map(l => <option key={l} value={l}>Target: {l}</option>)}
                      </select>
                      <button onClick={() => setInterestedSkills(interestedSkills.filter((_, idx) => idx !== i))} className="p-2 text-slate-300 hover:text-rose-500">
                        <Plus className="w-5 h-5 rotate-45" />
                      </button>
                    </div>
                  ))}
                  {interestedSkills.length === 0 && (
                    <button 
                      onClick={() => setInterestedSkills([...interestedSkills, { name: "", targetLevel: 'Advanced' }])}
                      className="w-full py-8 border-2 border-dashed border-amber-200 rounded-[2rem] text-amber-600 flex flex-col items-center justify-center gap-3 hover:bg-amber-50 transition-all font-bold text-xs uppercase tracking-widest"
                    >
                      <Target className="w-8 h-8 opacity-40 mx-auto" />
                      <span>Define Your Interest</span>
                    </button>
                  )}
                  {interestedSkills.length > 0 && (
                     <button 
                      onClick={() => setInterestedSkills([...interestedSkills, { name: "", targetLevel: 'Advanced' }])}
                      className="w-full py-4 border-2 border-dashed border-amber-100 rounded-2xl text-amber-600 flex items-center justify-center gap-2 hover:bg-amber-50 transition-all font-bold text-xs uppercase tracking-widest"
                    >
                      <Plus className="w-4 h-4" />
                      Add Another Interest
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-12 md:p-16 pt-0 flex items-center justify-between gap-6">
          {step > 1 ? (
             <button 
              onClick={prevStep}
              className="px-10 py-5 text-slate-400 font-bold hover:text-slate-900 transition-colors flex items-center gap-2"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
          ) : (
            <div />
          )}

          <button 
            onClick={nextStep}
            disabled={!canContinue()}
            className="px-12 py-5 bg-slate-900 text-white rounded-[2rem] font-bold text-lg hover:bg-black transition-all shadow-2xl shadow-slate-900/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-3 active:scale-95"
          >
            {step === totalSteps ? "Launch Journey" : "Next Step"}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function LearningHub({ resources, onAddLearning }: { resources: LearningResource[], onAddLearning: (r: LearningResource) => void }) {
  const [filter, setFilter] = useState<'All' | 'LinkedIn Learning' | 'Coursera' | 'Internal'>('All');
  const filtered = resources.filter(r => filter === 'All' || r.provider === filter);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12 pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-5xl font-bold tracking-tighter text-slate-900 italic font-serif">Learning Hub</h2>
          <p className="text-slate-400 mt-2 text-lg font-light">Aggregated intelligence across LinkedIn, Coursera, and Internal Academy.</p>
        </div>
        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
          {['All', 'LinkedIn Learning', 'Coursera', 'Internal'].map((p) => (
            <button key={p} onClick={() => setFilter(p as any)} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${filter === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{p.split(' ')[0]}</button>
          ))}
        </div>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.map(resource => (
          <div key={resource.id} className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl transition-all group flex flex-col h-full">
            <div className="flex justify-between items-start mb-6">
              <span className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] border ${resource.provider === 'LinkedIn Learning' ? 'bg-blue-50 text-blue-600 border-blue-100' : resource.provider === 'Coursera' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{resource.provider}</span>
              <div className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-400 fill-amber-400" /><span className="text-xs font-bold text-slate-900">{resource.rating || 4.8}</span></div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors leading-tight">{resource.title}</h3>
            <p className="text-slate-500 text-sm italic font-light mb-6 flex-1 line-clamp-3">"{resource.description}"</p>
            <div className="flex flex-wrap gap-2 mb-8">{resource.skills.map(skill => (<span key={skill} className="px-3 py-1 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest rounded-lg">{skill}</span>))}</div>
            <div className="flex items-center justify-between border-t border-slate-50 pt-6">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{resource.duration || '2h 15m'}</span>
              <a href={resource.url} target="_blank" rel="noreferrer" onClick={() => onAddLearning(resource)} className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-black transition-all shadow-lg shadow-slate-900/10 group-hover:scale-105"><ExternalLink className="w-4 h-4" /></a>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-32 bg-slate-50 rounded-[4rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
             <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4"><GraduationCap className="w-8 h-8 text-slate-200" /></div>
             <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Awaiting content aggregation...</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function GigMarketplace({ gigs }: { gigs: InternalGig[] }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12 pb-32">
      <header>
        <h2 className="text-5xl font-bold tracking-tighter text-slate-900">Opportunities</h2>
        <p className="text-slate-400 mt-2 text-lg font-light leading-relaxed max-w-2xl">Apply your skills to real internal projects. Cross-functional "gigs" designed for rapid upskilling.</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {gigs.map(gig => (
          <div key={gig.id} className="bg-slate-50/50 rounded-[3rem] p-10 border border-slate-100 hover:bg-white hover:shadow-2xl transition-all group">
            <div className="flex justify-between items-start mb-8">
              <div className="flex flex-col"><span className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em] mb-1">{gig.department}</span><h3 className="text-2xl font-bold text-slate-900">{gig.title}</h3></div>
              <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-100">{gig.status}</div>
            </div>
            <p className="text-slate-500 font-light italic leading-relaxed mb-8 line-clamp-3">"{gig.description}"</p>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100"><Target className="w-4 h-4 text-slate-400" /></div>
                <div className="flex flex-wrap gap-2">{gig.skillsRequired.map(skill => (<span key={skill} className="text-xs font-bold text-slate-900">{skill}</span>))}</div>
              </div>
              <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Est. Duration</span><span className="text-sm font-bold text-slate-900">{gig.duration}</span></div>
                <button className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-black transition-all">Apply for Gig</button>
              </div>
            </div>
          </div>
        ))}
        {gigs.length === 0 && (
           <div className="col-span-full py-32 bg-white rounded-[4rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center">
              <Briefcase className="w-12 h-12 text-slate-100 mb-4" /><p className="text-slate-300 font-bold uppercase tracking-[0.3em] text-[10px]">Project Marketplace closed</p>
           </div>
        )}
      </div>
    </motion.div>
  );
}

function SkillAnalytics({ users, skills }: { users: UserProfile[], skills: GlobalSkill[] }) {
  const departments = Array.from(new Set(users.map(u => u.department || 'Unknown')));
  const [selectedDept, setSelectedDept] = useState('All');
  const filteredUsers = selectedDept === 'All' ? users : users.filter(u => u.department === selectedDept);
  const skillDensity = skills.map(skill => {
    const experts = filteredUsers.filter(u => u.skillsExpert.some(s => s.name === skill.name)).length;
    const learners = filteredUsers.filter(u => u.skillsInterested.some(s => s.name === skill.name)).length;
    return { name: skill.name, experts, learners, ratio: experts / (learners || 1) };
  }).sort((a,b) => b.learners - a.learners).slice(0, 8);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-16 pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-50 pb-12">
        <div>
          <h2 className="text-5xl font-bold tracking-tighter text-slate-900 italic font-serif uppercase">Skill DNA</h2>
          <p className="text-slate-400 mt-2 text-lg font-light leading-relaxed max-w-xl">Real-time heatmaps for organizational capability. Identify "Expert Bottlenecks" and "Knowledge Hubs."</p>
        </div>
        <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="px-6 py-4 bg-slate-100 border-none rounded-2xl text-xs font-bold uppercase tracking-widest focus:ring-4 focus:ring-slate-900/5">
          <option value="All">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-8">
           <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] ml-2">Organizational Skill Heatmap</h3>
           <div className="space-y-4">
              {skillDensity.map(skill => (
                <div key={skill.name} className="bg-white p-6 rounded-[2rem] border border-slate-50 shadow-sm hover:translate-x-2 transition-transform cursor-default">
                   <div className="flex items-center justify-between mb-4">
                      <span className="text-lg font-bold text-slate-900">{skill.name}</span>
                      <div className="flex gap-4">
                         <div className="flex flex-col items-end"><span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Experts</span><span className="text-sm font-bold text-emerald-600">{skill.experts}</span></div>
                         <div className="flex flex-col items-end"><span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Learners</span><span className="text-sm font-bold text-blue-600">{skill.learners}</span></div>
                      </div>
                   </div>
                   <div className="h-1.5 w-full bg-slate-50 rounded-full flex overflow-hidden">
                      <div className="h-full bg-emerald-400 transition-all duration-1000" style={{ width: `${(skill.experts / (skill.experts + skill.learners || 1)) * 100}%` }} />
                      <div className="h-full bg-blue-400 opacity-30 transition-all duration-1000" style={{ width: `${(skill.learners / (skill.experts + skill.learners || 1)) * 100}%` }} />
                   </div>
                   <div className="flex justify-between mt-2"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gap analysis:</span><span className={`text-[10px] font-bold uppercase tracking-widest ${skill.ratio < 0.2 ? 'text-rose-500' : 'text-slate-400'}`}>{skill.ratio < 0.2 ? 'High Critical Gap' : 'Balanced'}</span></div>
                </div>
              ))}
           </div>
        </div>
        <div className="lg:col-span-4 space-y-8">
           <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
              <TrendingUp className="absolute -right-4 -bottom-4 w-32 h-32 text-white/5 rotate-12 group-hover:scale-110 transition-transform" />
              <h4 className="text-xl font-bold italic font-serif mb-2">Talent Velocity</h4>
              <p className="text-slate-400 text-xs font-medium leading-relaxed mb-8">System-wide skill movement recorded in the last 30 days.</p>
              <div className="space-y-6">
                 <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Skill Upgrades</span><span className="text-xl font-bold font-mono">142</span></div>
                 <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Certifications</span><span className="text-xl font-bold font-mono">28</span></div>
                 <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">New Experts</span><span className="text-xl font-bold font-mono">+12%</span></div>
              </div>
              <button className="w-full mt-12 py-4 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all">Generate Board Report</button>
           </div>
        </div>
      </div>
    </motion.div>
  );
}

function AssessmentPortal({ skill, onComplete, onClose }: { skill: string, onComplete: (score: number) => void, onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setStep(2), 1500);
    const timer2 = setTimeout(() => setStep(3), 3000);
    const timer3 = setTimeout(() => {
        const finalScore = Math.floor(Math.random() * 20) + 80; // 80-100
        setScore(finalScore);
    }, 4500);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-xl">
       <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[3.5rem] p-12 max-w-xl w-full shadow-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-100">
             <motion.div initial={{ width: "0%" }} animate={{ width: `${(step / 3) * 100}%` }} className="h-full bg-blue-600 transition-all duration-500" />
          </div>
          
          <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
             <ShieldCheck className="w-12 h-12 text-blue-600" />
          </div>
          <h3 className="text-4xl font-bold tracking-tighter text-slate-900 mb-2">Skill Verification</h3>
          <p className="text-slate-400 mb-12 text-lg font-light">Authorized evaluation via <span className="text-slate-900 font-bold">Pluralsight Role IQ</span> for <span className="text-blue-600 font-bold italic font-serif underline decoration-blue-200 underline-offset-4">{skill}</span>.</p>
          
          <div className="space-y-8">
             <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-300">
                <span>Phase {step} of 3</span>
                <span>{step === 3 && score > 0 ? 'Synthesis Complete' : 'Analyzing Proficiency'}</span>
             </div>
             
             {score > 0 ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="pt-8">
                   <div className="text-7xl font-mono font-bold text-slate-900 mb-4 tracking-tighter">{score}</div>
                   <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Proficiency Verified: Expert
                   </div>
                   <button 
                     onClick={() => onComplete(score)} 
                     className="w-full mt-12 px-12 py-5 bg-slate-900 text-white rounded-[2rem] font-bold text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95"
                   >
                     Claim Digital Credentials
                   </button>
                </motion.div>
             ) : (
                <div className="py-12 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                   <div className="italic text-slate-400 font-light text-sm animate-pulse mb-4">
                      {step === 1 ? 'Generating dynamic problem set...' : step === 2 ? 'Evaluating multi-variant response patterns...' : 'Compiling enterprise capability score...'}
                   </div>
                   <div className="flex justify-center gap-1">
                      {[0,1,2].map(i => (
                        <motion.div 
                          key={i}
                          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                          transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                          className="w-1.5 h-1.5 bg-blue-600 rounded-full"
                        />
                      ))}
                   </div>
                </div>
             )}
          </div>

          <button 
            onClick={onClose}
            className="mt-8 text-xs font-bold text-slate-300 hover:text-slate-600 transition-colors uppercase tracking-widest"
          >
            Cancel Assessment
          </button>
       </motion.div>
    </div>
  );
}
