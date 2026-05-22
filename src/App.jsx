import React, { useEffect, useMemo, useState } from "react";
import { adObjectives, adPlatforms, aiMediaProviders, createInitialWorkspace, fontStyles, goals, normalizeBrand, platforms, tones } from "./data/models.js";
import { generateAdVariations } from "./services/adsGenerator.js";
import { generateArtCardForPost, generatePostsForBrand, generatePostsForBrandWithAI, generateVideoForPost, previewForBrand } from "./services/contentGenerator.js";
import { fetchIntegrationStatus, publishPost, publishQueue } from "./services/integrations.js";
import { runAutopilotPlan } from "./services/autopilot.js";
import { schedulePosts, workspaceTotals } from "./services/scheduler.js";
import { exportWorkspace, loadWorkspace, saveWorkspace } from "./services/storage.js";

function createSeededWorkspace() {
  const workspace = createInitialWorkspace();
  return {
    ...workspace,
    brands: workspace.brands.map((brand) => {
      const normalizedBrand = normalizeBrand(brand);
      return {
        ...normalizedBrand,
        posts: generatePostsForBrand(normalizedBrand),
      };
    }),
  };
}

function normalizeWorkspace(workspace) {
  return {
    ...workspace,
    activeBrandId: workspace.activeBrandId ?? workspace.brands?.[0]?.id ?? "luna",
    brands: (workspace.brands ?? []).map(normalizeBrand),
  };
}

function updateBrand(brands, brandId, updater) {
  return brands.map((brand) => (brand.id === brandId ? updater(brand) : brand));
}

function App() {
  const [workspace, setWorkspace] = useState(() => normalizeWorkspace(loadWorkspace(createSeededWorkspace())));
  const [previewMode, setPreviewMode] = useState("card");
  const [exportLabel, setExportLabel] = useState("Export plan");
  const [generationState, setGenerationState] = useState({ status: "idle", message: "AI generator ready" });
  const [selectedPreviewPostId, setSelectedPreviewPostId] = useState(null);
  const [artGenerationState, setArtGenerationState] = useState({ status: "idle", message: "Art generator ready" });
  const [videoGenerationState, setVideoGenerationState] = useState({ status: "idle", message: "Video generator ready" });
  const [autopilotCommand, setAutopilotCommand] = useState("Generate 2 weeks of content for this brand. Post daily to all active channels and schedule it.");
  const [autopilotState, setAutopilotState] = useState({ status: "idle", message: "Autopilot ready" });
  const [integrationStatus, setIntegrationStatus] = useState([]);
  const [publishState, setPublishState] = useState({ status: "idle", message: "Publishing APIs waiting for credentials" });

  const activeBrand = useMemo(
    () => workspace.brands.find((brand) => brand.id === workspace.activeBrandId) ?? workspace.brands[0],
    [workspace.activeBrandId, workspace.brands],
  );
  const totals = useMemo(() => workspaceTotals(workspace.brands), [workspace.brands]);
  const preview = useMemo(() => previewForBrand(activeBrand), [activeBrand]);
  const selectedPlatformSet = useMemo(() => new Set(activeBrand.selectedPlatformIds), [activeBrand.selectedPlatformIds]);
  const selectedPostCount = useMemo(() => activeBrand.posts.filter((post) => post.selected).length, [activeBrand.posts]);
  const previewPost = useMemo(
    () => activeBrand.posts.find((post) => post.id === selectedPreviewPostId) ?? activeBrand.posts[0],
    [activeBrand.posts, selectedPreviewPostId],
  );

  useEffect(() => {
    saveWorkspace(workspace);
  }, [workspace]);

  useEffect(() => {
    refreshIntegrationStatus();
  }, []);

  function setActiveBrand(brandId) {
    setWorkspace((current) => ({ ...current, activeBrandId: brandId }));
  }

  function patchActiveBrand(patch) {
    setWorkspace((current) => ({
      ...current,
      brands: updateBrand(current.brands, current.activeBrandId, (brand) => ({ ...brand, ...patch })),
    }));
  }

  function patchBusinessProfile(patch) {
    setWorkspace((current) => ({
      ...current,
      brands: updateBrand(current.brands, current.activeBrandId, (brand) => ({
        ...brand,
        businessProfile: {
          ...brand.businessProfile,
          ...patch,
        },
      })),
    }));
  }

  function patchAdBrief(patch) {
    setWorkspace((current) => ({
      ...current,
      brands: updateBrand(current.brands, current.activeBrandId, (brand) => ({
        ...brand,
        adBrief: {
          ...brand.adBrief,
          ...patch,
        },
      })),
    }));
  }

  function patchMediaSettings(patch) {
    setWorkspace((current) => ({
      ...current,
      brands: updateBrand(current.brands, current.activeBrandId, (brand) => ({
        ...brand,
        mediaSettings: {
          ...brand.mediaSettings,
          ...patch,
        },
      })),
    }));
  }

  function toggleAdPlatform(platformId) {
    setWorkspace((current) => ({
      ...current,
      brands: updateBrand(current.brands, current.activeBrandId, (brand) => {
        const ids = new Set(brand.adBrief.platformIds);
        if (ids.has(platformId)) ids.delete(platformId);
        else ids.add(platformId);
        return {
          ...brand,
          adBrief: {
            ...brand.adBrief,
            platformIds: [...ids],
          },
        };
      }),
    }));
  }

  function togglePlatform(platformId) {
    setWorkspace((current) => ({
      ...current,
      brands: updateBrand(current.brands, current.activeBrandId, (brand) => {
        const ids = new Set(brand.selectedPlatformIds);
        if (ids.has(platformId)) {
          ids.delete(platformId);
        } else {
          ids.add(platformId);
        }

        return { ...brand, selectedPlatformIds: [...ids] };
      }),
    }));
  }

  function uploadLogo(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      patchActiveBrand({ logoImageUrl: reader.result });
    };
    reader.readAsDataURL(file);
  }

  async function generateActiveBrand() {
    const brand = activeBrand;
    setGenerationState({ status: "loading", message: `Generating ${brand.name} with AI...` });

    try {
      const result = await generatePostsForBrandWithAI(brand);
      setWorkspace((current) => ({
        ...current,
        brands: updateBrand(current.brands, brand.id, (currentBrand) => ({
          ...currentBrand,
          aiPreview: result.preview,
          posts: result.posts,
        })),
      }));
      setGenerationState({
        status: result.source,
        message: result.source === "openai" ? `Generated with OpenAI ${result.model}` : `Generated with local fallback: ${result.reason}`,
      });
    } catch (error) {
      setWorkspace((current) => ({
        ...current,
        brands: updateBrand(current.brands, brand.id, (currentBrand) => ({
          ...currentBrand,
          aiPreview: previewForBrand(currentBrand),
          posts: generatePostsForBrand(currentBrand),
        })),
      }));
      setGenerationState({ status: "fallback", message: error instanceof Error ? error.message : "AI generation failed; fallback used" });
    }
  }

  async function generateAllBrands() {
    setGenerationState({ status: "loading", message: "Generating every brand workspace with AI..." });

    const results = await Promise.all(
      workspace.brands.map(async (brand) => {
        try {
          const result = await generatePostsForBrandWithAI(brand);
          return { brandId: brand.id, result };
        } catch (error) {
          return {
            brandId: brand.id,
            result: {
              source: "fallback",
              reason: error instanceof Error ? error.message : "AI generation failed",
              preview: previewForBrand(brand),
              posts: generatePostsForBrand(brand),
            },
          };
        }
      }),
    );

    const resultByBrand = new Map(results.map((item) => [item.brandId, item.result]));
    setWorkspace((current) => ({
      ...current,
      brands: current.brands.map((brand) => {
        const result = resultByBrand.get(brand.id);
        return result
          ? {
              ...brand,
              aiPreview: result.preview,
              posts: result.posts,
            }
          : brand;
      }),
    }));

    const openAiCount = results.filter((item) => item.result.source === "openai").length;
    setGenerationState({
      status: openAiCount > 0 ? "openai" : "fallback",
      message: openAiCount > 0 ? `Generated ${openAiCount} brand workspaces with OpenAI` : "Generated all brands with local fallback",
    });
  }

  function runAutopilot() {
    const plan = runAutopilotPlan(activeBrand, autopilotCommand);
    setWorkspace((current) => ({
      ...current,
      brands: updateBrand(current.brands, activeBrand.id, (brand) => ({
        ...brand,
        posts: plan.posts,
        queue: plan.posts,
        lastAutopilotPlan: {
          command: plan.command,
          durationDays: plan.durationDays,
          topic: plan.topic,
          createdAt: new Date().toISOString(),
        },
      })),
    }));
    setSelectedPreviewPostId(plan.posts[0]?.id ?? null);
    setAutopilotState({ status: "scheduled", message: `${plan.summary}. ${plan.posts.length} posts generated and scheduled.` });
  }

  async function generateArtCard(postId) {
    const post = activeBrand.posts.find((item) => item.id === postId);
    if (!post) return;

    setSelectedPreviewPostId(post.id);
    setPreviewMode("card");
    setArtGenerationState({ status: "loading", message: `Generating ${post.platformName} art card...` });

    try {
      const result = await generateArtCardForPost(activeBrand, post);
      setWorkspace((current) => ({
        ...current,
        brands: updateBrand(current.brands, activeBrand.id, (brand) => ({
          ...brand,
          posts: brand.posts.map((item) =>
            item.id === post.id
              ? {
                  ...item,
                  artImageUrl: result.imageUrl,
                  artSource: result.source,
                  artModel: result.model,
                  artAsset: result.asset,
                }
              : item,
          ),
        })),
      }));
      setArtGenerationState({
        status: result.source,
        message: result.source === "openai" || result.source === "gemini" ? `Art card generated with ${result.model}` : `Fallback art card created: ${result.reason}`,
      });
    } catch (error) {
      setArtGenerationState({ status: "fallback", message: error instanceof Error ? error.message : "Art generation failed" });
    }
  }

  async function generateVideo(postId) {
    const post = activeBrand.posts.find((item) => item.id === postId);
    if (!post) return;

    setSelectedPreviewPostId(post.id);
    setPreviewMode("video");
    setVideoGenerationState({ status: "loading", message: `Starting ${post.platformName} video generation...` });

    try {
      const result = await generateVideoForPost(activeBrand, post);
      setWorkspace((current) => ({
        ...current,
        brands: updateBrand(current.brands, activeBrand.id, (brand) => ({
          ...brand,
          posts: brand.posts.map((item) =>
            item.id === post.id
              ? {
                  ...item,
                  videoUrl: result.videoUrl,
                  videoSource: result.source,
                  videoModel: result.model,
                  videoStatus: result.status,
                  videoOperationName: result.operationName,
                  videoAsset: result.asset,
                }
              : item,
          ),
        })),
      }));
      setVideoGenerationState({
        status: result.status || result.source,
        message: result.operationName ? `Veo video job started with ${result.model}` : result.reason || "Video generation request sent",
      });
    } catch (error) {
      setVideoGenerationState({ status: "failed", message: error instanceof Error ? error.message : "Video generation failed" });
    }
  }

  function togglePost(postId) {
    setWorkspace((current) => ({
      ...current,
      brands: updateBrand(current.brands, current.activeBrandId, (brand) => ({
        ...brand,
        posts: brand.posts.map((post) => (post.id === postId ? { ...post, selected: !post.selected } : post)),
      })),
    }));
  }

  function scheduleSelectedPosts() {
    setWorkspace((current) => ({
      ...current,
      brands: updateBrand(current.brands, current.activeBrandId, (brand) =>
        schedulePosts(
          brand,
          brand.posts.filter((post) => post.selected),
        ),
      ),
    }));
  }

  function scheduleSinglePost(postId) {
    setWorkspace((current) => ({
      ...current,
      brands: updateBrand(current.brands, current.activeBrandId, (brand) => {
        const post = brand.posts.find((item) => item.id === postId);
        return post ? schedulePosts(brand, [post]) : brand;
      }),
    }));
  }

  async function handleExport() {
    await navigator.clipboard.writeText(exportWorkspace(workspace));
    setExportLabel("Copied JSON");
    window.setTimeout(() => setExportLabel("Export plan"), 1600);
  }

  async function refreshIntegrationStatus() {
    try {
      const result = await fetchIntegrationStatus();
      setIntegrationStatus(result.integrations ?? []);
    } catch (error) {
      setPublishState({ status: "failed", message: error instanceof Error ? error.message : "Could not load API connection status" });
    }
  }

  async function publishSinglePost(postId) {
    const post = activeBrand.posts.find((item) => item.id === postId);
    if (!post) return;

    try {
      setPublishState({ status: "loading", message: `Publishing ${post.platformName} post...` });
      const result = await publishPost(activeBrand, post);
      setPublishState({ status: result.status, message: result.message });

      if (result.status === "published") {
        setWorkspace((current) => ({
          ...current,
          brands: updateBrand(current.brands, activeBrand.id, (brand) => ({
            ...brand,
            posts: brand.posts.map((item) => (item.id === post.id ? { ...item, status: "published", publishedAt: result.at } : item)),
            queue: brand.queue.map((item) => (item.id === post.id ? { ...item, status: "published", publishedAt: result.at } : item)),
          })),
        }));
      }
    } catch (error) {
      setPublishState({ status: "failed", message: error instanceof Error ? error.message : "Publishing failed" });
    }
  }

  async function publishActiveQueue() {
    try {
      setPublishState({ status: "loading", message: `Publishing ${activeBrand.queue.length} queued posts...` });
      const result = await publishQueue(activeBrand, activeBrand.queue);
      const publishedIds = new Set(result.results.filter((item) => item.status === "published").map((item) => item.postId));
      setPublishState({ status: result.blocked > 0 ? "blocked" : "published", message: `${result.published} published, ${result.blocked} blocked by credentials/media requirements.` });

      if (publishedIds.size > 0) {
        setWorkspace((current) => ({
          ...current,
          brands: updateBrand(current.brands, activeBrand.id, (brand) => ({
            ...brand,
            posts: brand.posts.map((post) => (publishedIds.has(post.id) ? { ...post, status: "published" } : post)),
            queue: brand.queue.map((post) => (publishedIds.has(post.id) ? { ...post, status: "published" } : post)),
          })),
        }));
      }
    } catch (error) {
      setPublishState({ status: "failed", message: error instanceof Error ? error.message : "Queue publishing failed" });
    }
  }

  function generateAds() {
    const variations = generateAdVariations(activeBrand);
    setWorkspace((current) => ({
      ...current,
      brands: updateBrand(current.brands, activeBrand.id, (brand) => ({
        ...brand,
        adVariations: variations,
      })),
    }));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">KS</div>
          <div>
            <p className="eyebrow">Katmon Studio</p>
            <h1>Grow your brand content.</h1>
          </div>
        </div>

        <section className="brand-panel">
          <div className="section-heading">
            <p>Brand workspaces</p>
            <span>{workspace.brands.length} brands</span>
          </div>
          <div className="brand-list">
            {workspace.brands.map((brand) => (
              <button
                className={`brand-switch ${brand.id === activeBrand.id ? "is-active" : ""}`}
                key={brand.id}
                onClick={() => setActiveBrand(brand.id)}
                type="button"
              >
                <span className="brand-avatar">{brand.initials}</span>
                <span>
                  <strong>{brand.name}</strong>
                  <span>{brand.tone}</span>
                </span>
                <span className="brand-queue-count">{brand.queue.length}</span>
              </button>
            ))}
          </div>
          <button className="sidebar-button" onClick={generateAllBrands} type="button">
            {generationState.status === "loading" ? "Generating..." : "Generate all brands"}
          </button>
        </section>

        <nav className="nav-stack" aria-label="Workspace">
          <a className="nav-item is-active" href="#generator">
            Generator
          </a>
          <a className="nav-item" href="#calendar">
            Calendar
          </a>
          <a className="nav-item" href="#ads">
            Ads
          </a>
          <a className="nav-item" href="#channels">
            Channels
          </a>
          <a className="nav-item" href="#analytics">
            Analytics
          </a>
        </nav>

        <section className="connection-panel" id="channels">
          <div className="section-heading">
            <p>Connected channels</p>
            <span>{activeBrand.selectedPlatformIds.length} active</span>
          </div>
          <div className="channel-list">
            {platforms.map((platform) => {
              const connected = selectedPlatformSet.has(platform.id);
              const apiStatus = integrationStatus.find((item) => item.platformId === platform.id);
              const ready = apiStatus?.status === "ready";
              return (
                <div className="channel" key={platform.id}>
                  <div>
                    <strong>{platform.name}</strong>
                    <p className="eyebrow">{connected ? (ready ? "API ready" : "Needs credentials") : "Not selected"}</p>
                  </div>
                  <span className={`status-dot ${connected && ready ? "" : "is-muted"}`} aria-label={connected && ready ? "API ready" : "Disconnected"} />
                </div>
              );
            })}
          </div>
          <button className="sidebar-button secondary" onClick={refreshIntegrationStatus} type="button">
            Refresh API status
          </button>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Katmon cockpit</p>
            <h2>AI marketing studio</h2>
            <p className="active-brand-line">{activeBrand.name} workspace</p>
          </div>
          <div className="topbar-actions">
            <button className="primary-button compact" disabled={generationState.status === "loading"} onClick={generateActiveBrand} type="button">
              {generationState.status === "loading" ? "Generating..." : "Generate with AI"}
            </button>
            <button className="ghost-button" onClick={handleExport} type="button">
              {exportLabel}
            </button>
          </div>
        </header>

        <section className="status-overview" aria-label="Workspace status">
          <StatusCard label="Drafts" value={activeBrand.posts.length} detail={`${selectedPostCount} selected`} />
          <StatusCard label="Scheduled" value={activeBrand.queue.length} detail={`${totals.scheduled} total queued`} />
          <StatusCard label="AI" value={activeBrand.posts[0]?.generationSource === "openai" ? "Live" : "Fallback"} detail={generationState.message} />
          <StatusCard label="APIs" value={`${integrationStatus.filter((item) => item.status === "ready").length}/${platforms.length}`} detail={publishState.message} />
        </section>

        <section className={`autopilot-panel ${autopilotState.status}`}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Autopilot</p>
              <h3>Tell it what to do. It plans, generates, and schedules.</h3>
            </div>
            <span>{autopilotState.message}</span>
          </div>
          <textarea
            aria-label="Autopilot command"
            rows="3"
            value={autopilotCommand}
            onChange={(event) => setAutopilotCommand(event.target.value)}
          />
          <div className="autopilot-actions">
            <button className="primary-button" onClick={runAutopilot} type="button">
              Run Autopilot
            </button>
            <p>Default mode schedules everything locally for review. Real auto-posting turns on after platform accounts are connected.</p>
          </div>
        </section>

        <section className="generator-grid" id="generator">
          <form
            className="brief-panel"
            onSubmit={(event) => {
              event.preventDefault();
              generateActiveBrand();
            }}
          >
            <div className="section-heading">
              <p>Creative brief</p>
              <span>{activeBrand.selectedPlatformIds.length} channels</span>
            </div>
            <p className="panel-note">Describe the campaign once. The AI adapts the output for each selected platform.</p>

            <label>
              Brand or offer
              <input value={activeBrand.name} onChange={(event) => patchActiveBrand({ name: event.target.value })} />
            </label>

            <label>
              Campaign goal
              <select value={activeBrand.goal} onChange={(event) => patchActiveBrand({ goal: event.target.value })}>
                {goals.map((goal) => (
                  <option key={goal}>{goal}</option>
                ))}
              </select>
            </label>

            <label>
              Audience
              <input value={activeBrand.audience} onChange={(event) => patchActiveBrand({ audience: event.target.value })} />
            </label>

            <label>
              Key message
              <textarea rows="4" value={activeBrand.message} onChange={(event) => patchActiveBrand({ message: event.target.value })} />
            </label>

            <details className="business-profile-panel" aria-label="Business profile">
              <summary>
                <span>
                  <strong>Business profile</strong>
                  <small>AI memory for offers, services, proof, and brand rules</small>
                </span>
                <em>Edit</em>
              </summary>
              <p className="panel-note">This becomes the context Autopilot uses when you only say “generate 2 weeks of content.”</p>
              <div className="field-row">
                <label>
                  Industry
                  <input value={activeBrand.businessProfile.industry} onChange={(event) => patchBusinessProfile({ industry: event.target.value })} />
                </label>
                <label>
                  Location / service area
                  <input value={activeBrand.businessProfile.location} onChange={(event) => patchBusinessProfile({ location: event.target.value })} />
                </label>
              </div>
              <label>
                Services / products
                <textarea rows="3" value={activeBrand.businessProfile.services} onChange={(event) => patchBusinessProfile({ services: event.target.value })} />
              </label>
              <label>
                Main offer
                <textarea rows="2" value={activeBrand.businessProfile.mainOffer} onChange={(event) => patchBusinessProfile({ mainOffer: event.target.value })} />
              </label>
              <label>
                Ideal customer
                <input value={activeBrand.businessProfile.idealCustomer} onChange={(event) => patchBusinessProfile({ idealCustomer: event.target.value })} />
              </label>
              <div className="field-row">
                <label>
                  Booking / website link
                  <input value={activeBrand.businessProfile.bookingLink} onChange={(event) => patchBusinessProfile({ bookingLink: event.target.value })} />
                </label>
                <label>
                  Content pillars
                  <input value={activeBrand.businessProfile.contentPillars} onChange={(event) => patchBusinessProfile({ contentPillars: event.target.value })} />
                </label>
              </div>
              <label>
                Proof / testimonials
                <textarea rows="2" value={activeBrand.businessProfile.proof} onChange={(event) => patchBusinessProfile({ proof: event.target.value })} />
              </label>
              <label>
                FAQs
                <textarea rows="2" value={activeBrand.businessProfile.faqs} onChange={(event) => patchBusinessProfile({ faqs: event.target.value })} />
              </label>
              <div className="field-row">
                <label>
                  Brand dos
                  <textarea rows="2" value={activeBrand.businessProfile.brandDos} onChange={(event) => patchBusinessProfile({ brandDos: event.target.value })} />
                </label>
                <label>
                  Brand don'ts
                  <textarea rows="2" value={activeBrand.businessProfile.brandDonts} onChange={(event) => patchBusinessProfile({ brandDonts: event.target.value })} />
                </label>
              </div>
            </details>

            <details className="brand-kit-panel" aria-label="Brand kit">
              <summary>
                <span>
                  <strong>Brand kit</strong>
                  <small>Logo, colors, and art direction</small>
                </span>
                <em>Edit</em>
              </summary>
              <div className="brand-kit-preview">
                <div
                  className="brand-kit-logo"
                  style={{
                    "--brand-primary": activeBrand.primaryColor,
                    "--brand-secondary": activeBrand.secondaryColor,
                  }}
                >
                  {activeBrand.logoImageUrl ? <img src={activeBrand.logoImageUrl} alt={`${activeBrand.name} logo`} /> : activeBrand.logoText}
                </div>
                <div>
                  <strong>{activeBrand.name}</strong>
                  <span>{activeBrand.fontStyle}</span>
                </div>
              </div>
              <div className="field-row three">
                <label>
                  Logo text
                  <input value={activeBrand.logoText} onChange={(event) => patchActiveBrand({ logoText: event.target.value })} />
                </label>
                <label>
                  Font style
                  <select value={activeBrand.fontStyle} onChange={(event) => patchActiveBrand({ fontStyle: event.target.value })}>
                    {fontStyles.map((style) => (
                      <option key={style}>{style}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Art provider
                  <select value={activeBrand.mediaSettings.artProvider} onChange={(event) => patchMediaSettings({ artProvider: event.target.value })}>
                    {aiMediaProviders.art.map((provider) => (
                      <option key={provider.id} value={provider.id}>{provider.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Video provider
                  <select value={activeBrand.mediaSettings.videoProvider} onChange={(event) => patchMediaSettings({ videoProvider: event.target.value })}>
                    {aiMediaProviders.video.map((provider) => (
                      <option key={provider.id} value={provider.id}>{provider.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="logo-upload">
                Upload logo
                <input accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => uploadLogo(event.target.files?.[0])} type="file" />
                <span>{activeBrand.logoImageUrl ? "Logo image attached to this brand kit." : "PNG, JPG, WebP, or SVG. Stored locally in this browser."}</span>
              </label>
              {activeBrand.logoImageUrl ? (
                <button className="text-button" onClick={() => patchActiveBrand({ logoImageUrl: "" })} type="button">
                  Remove uploaded logo
                </button>
              ) : null}
              <div className="color-row">
                <label>
                  Primary
                  <input type="color" value={activeBrand.primaryColor} onChange={(event) => patchActiveBrand({ primaryColor: event.target.value })} />
                </label>
                <label>
                  Secondary
                  <input type="color" value={activeBrand.secondaryColor} onChange={(event) => patchActiveBrand({ secondaryColor: event.target.value })} />
                </label>
                <label>
                  Accent
                  <input type="color" value={activeBrand.accentColor} onChange={(event) => patchActiveBrand({ accentColor: event.target.value })} />
                </label>
              </div>
            </details>

            <div className="field-row">
              <label>
                Tone
                <select value={activeBrand.tone} onChange={(event) => patchActiveBrand({ tone: event.target.value })}>
                  {tones.map((tone) => (
                    <option key={tone}>{tone}</option>
                  ))}
                </select>
              </label>
              <label>
                Post date
                <input type="date" value={activeBrand.postDate} onChange={(event) => patchActiveBrand({ postDate: event.target.value })} />
              </label>
            </div>

            <fieldset>
              <legend>Platforms</legend>
              <div className="platform-pills">
                {platforms.map((platform) => (
                  <label key={platform.id}>
                    <input checked={selectedPlatformSet.has(platform.id)} onChange={() => togglePlatform(platform.id)} type="checkbox" />
                    {platform.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <button className="primary-button" type="submit">
              {generationState.status === "loading" ? "Generating..." : "Generate content set"}
            </button>
          </form>

          <section className="preview-panel">
            <div className="preview-toolbar">
              <div>
                <p className="eyebrow">Preview</p>
                <h3>{previewMode === "video" ? "Short video preview" : "Instagram art card"}</h3>
              </div>
              <div className="segmented-control" role="tablist" aria-label="Preview type">
                <button className={previewMode === "card" ? "is-active" : ""} onClick={() => setPreviewMode("card")} type="button">
                  Art card
                </button>
                <button className={previewMode === "video" ? "is-active" : ""} onClick={() => setPreviewMode("video")} type="button">
                  Video
                </button>
              </div>
            </div>

            <div className="creative-stage">
              {previewMode === "card" ? (
                previewPost?.artImageUrl ? (
                  <article className="generated-art-card" style={{ aspectRatio: `${previewPost.width} / ${previewPost.height}` }}>
                    <img src={previewPost.artImageUrl} alt={`${previewPost.platformName} generated art card for ${activeBrand.name}`} />
                    <span>{previewPost.platformName} · {previewPost.width}x{previewPost.height}</span>
                  </article>
                ) : (
                  <article
                    className="art-card"
                    style={{
                      "--brand-primary": activeBrand.primaryColor,
                      "--brand-secondary": activeBrand.secondaryColor,
                      "--brand-accent": activeBrand.accentColor,
                      aspectRatio: previewPost ? `${previewPost.width} / ${previewPost.height}` : undefined,
                    }}
                    >
                    <div className="card-orbit" />
                    <div className="art-logo">{activeBrand.logoImageUrl ? <img src={activeBrand.logoImageUrl} alt="" /> : activeBrand.logoText}</div>
                    <p>{preview.brandName}</p>
                    <h4>{preview.headline}</h4>
                    <span>{previewPost ? `${previewPost.platformName} · ${previewPost.width}x${previewPost.height}` : preview.cta}</span>
                  </article>
                )
              ) : (
                <article className="video-card">
                  {previewPost?.videoUrl ? (
                    <video className="video-frame" controls src={previewPost.videoUrl} />
                  ) : (
                    <div className="video-frame">
                      <div className="video-progress" />
                      <span>{previewPost?.videoStatus === "processing" ? "Veo" : "00:12"}</span>
                    </div>
                  )}
                  <div className="subtitle-strip">{preview.subtitle}</div>
                  {previewPost?.videoOperationName ? <p className="panel-note">Veo job started: {previewPost.videoOperationName}</p> : null}
                </article>
              )}
            </div>
          </section>
        </section>

        <section className="ads-studio-panel" id="ads">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Ads Studio</p>
              <h3>Ad creative generator</h3>
              <p className="panel-note">Generate ad copy, hooks, audiences, and creative prompts. Direct ad buying comes later after ad account APIs are approved.</p>
            </div>
            <button className="primary-button" onClick={generateAds} type="button">
              Generate ad set
            </button>
          </div>

          <div className="ad-brief-grid">
            <label>
              Objective
              <select value={activeBrand.adBrief.objective} onChange={(event) => patchAdBrief({ objective: event.target.value })}>
                {adObjectives.map((objective) => (
                  <option key={objective}>{objective}</option>
                ))}
              </select>
            </label>
            <label>
              Budget
              <input value={activeBrand.adBrief.budget} onChange={(event) => patchAdBrief({ budget: event.target.value })} />
            </label>
            <label>
              Duration
              <input value={activeBrand.adBrief.duration} onChange={(event) => patchAdBrief({ duration: event.target.value })} />
            </label>
            <label>
              Landing page
              <input value={activeBrand.adBrief.landingPage} onChange={(event) => patchAdBrief({ landingPage: event.target.value })} />
            </label>
            <label className="wide-field">
              Offer
              <textarea rows="2" value={activeBrand.adBrief.offer} onChange={(event) => patchAdBrief({ offer: event.target.value })} />
            </label>
            <label className="wide-field">
              Ad audience
              <textarea rows="2" value={activeBrand.adBrief.audience} onChange={(event) => patchAdBrief({ audience: event.target.value })} />
            </label>
          </div>

          <fieldset>
            <legend>Ad platforms</legend>
            <div className="platform-pills">
              {adPlatforms.map((platform) => (
                <label key={platform.id}>
                  <input checked={activeBrand.adBrief.platformIds.includes(platform.id)} onChange={() => toggleAdPlatform(platform.id)} type="checkbox" />
                  {platform.name}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="ad-grid">
            {activeBrand.adVariations.length === 0 ? (
              <div className="ad-empty">
                <strong>No ad creatives yet</strong>
                <p>Choose an objective and platforms, then generate your first ad set.</p>
              </div>
            ) : (
              activeBrand.adVariations.map((ad) => <AdCard ad={ad} key={ad.id} />)
            )}
          </div>
        </section>

        <section className="content-board">
          <div className="board-header">
            <div>
              <p className="eyebrow">Generated set</p>
              <h3>Platform-ready drafts</h3>
              <p className="board-subtitle">{selectedPostCount} selected for scheduling across {activeBrand.selectedPlatformIds.length} active channels.</p>
            </div>
            <button className="ghost-button" disabled={selectedPostCount === 0} onClick={scheduleSelectedPosts} type="button">
              Schedule selected
            </button>
            <button className="primary-button" disabled={activeBrand.queue.length === 0 || publishState.status === "loading"} onClick={publishActiveQueue} type="button">
              Publish queue
            </button>
          </div>
          <div className="post-grid">
            {activeBrand.posts.map((post) => (
              <PostCard
                isPreviewed={previewPost?.id === post.id}
                key={post.id}
                onGenerateArt={generateArtCard}
                onGenerateVideo={generateVideo}
                onPreview={setSelectedPreviewPostId}
                onPublish={publishSinglePost}
                onSchedule={scheduleSinglePost}
                onToggle={togglePost}
                post={post}
              />
            ))}
          </div>
        </section>

        <section className="calendar-analytics">
          <section className="calendar-panel" id="calendar">
            <div className="section-heading">
              <p>Publishing queue</p>
              <span>{activeBrand.queue.length} scheduled</span>
            </div>
            <div className="queue-list">
              {activeBrand.queue.length === 0 ? (
                <EmptyQueue brandName={activeBrand.name} selectedPostCount={selectedPostCount} />
              ) : (
                activeBrand.queue.map((post) => <QueueItem key={post.id} post={post} />)
              )}
            </div>
          </section>

          <section className="analytics-panel" id="analytics">
            <div className="section-heading">
              <p>Forecast</p>
              <span>Simulated</span>
            </div>
            <div className="metric-strip">
              <Metric label="estimated reach" value={`${(Math.max(activeBrand.posts.length, 1) * 4.6).toFixed(1)}k`} />
              <Metric label="engagement" value={`${(4.2 + Math.max(activeBrand.posts.length, 1) * 0.35).toFixed(1)}%`} />
              <Metric label="best slot" value={activeBrand.posts[0]?.time ?? "9:30 AM"} />
            </div>
            <div className="bar-chart" aria-label="Projected engagement by day">
              {[42, 66, 52, 88, 73, 61, 79].map((height) => (
                <span key={height} style={{ "--height": `${height}%` }} />
              ))}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

function StatusCard({ label, value, detail }) {
  return (
    <div className="status-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function AdCard({ ad }) {
  return (
    <article className="ad-card">
      <header>
        <span>{ad.platformName}</span>
        <small>{ad.angle}</small>
      </header>
      <h4>{ad.headline}</h4>
      <p>{ad.primaryText}</p>
      <dl>
        <div>
          <dt>CTA</dt>
          <dd>{ad.callToAction}</dd>
        </div>
        <div>
          <dt>Budget</dt>
          <dd>{ad.budget}</dd>
        </div>
      </dl>
      <details>
        <summary>Creative prompt</summary>
        <p>{ad.creativePrompt}</p>
        <p>{ad.complianceNote}</p>
      </details>
    </article>
  );
}

function PostCard({ isPreviewed, post, onGenerateArt, onGenerateVideo, onPreview, onPublish, onSchedule, onToggle }) {
  return (
    <article className={`post-card ${isPreviewed ? "is-previewed" : ""}`}>
      <header>
        <div>
          <h4>{post.platformName}</h4>
          <p>
            {post.brandName} · {post.format} · {post.media}
          </p>
        </div>
        <div className="post-card-tools">
          <span className={`source-chip ${post.generationSource}`}>{post.generationSource === "openai" ? "AI" : "Draft"}</span>
          <input aria-label={`Select ${post.platformName}`} checked={post.selected} onChange={() => onToggle(post.id)} type="checkbox" />
        </div>
      </header>
      <p>{post.caption}</p>
      <div className="hashtag-row">
        {post.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <details className="creative-brieflet">
        <summary>AI creative details</summary>
        <p>{post.visualPrompt}</p>
        {post.videoScript ? <p>{post.videoScript}</p> : null}
      </details>
      <div className="media-status">
        <span>{post.videoStatus === "processing" ? "Veo video processing" : post.artAsset?.provider === "vercel_blob" ? "Hosted media ready" : post.artImageUrl ? "Art image attached" : "No art image yet"}</span>
        <span>{post.videoModel || post.artModel || "Media provider ready"}</span>
      </div>
      <div className="card-actions">
        <span>
          {post.date} · {post.time}
          <small>{post.width}x{post.height} · {post.ratio}</small>
        </span>
        <div className="post-actions">
          <button onClick={() => onPreview(post.id)} type="button">
            Preview
          </button>
          <button onClick={() => onGenerateArt(post.id)} type="button">
            Generate art
          </button>
          {post.media === "Video" ? (
            <button onClick={() => onGenerateVideo(post.id)} type="button">
              Generate video
            </button>
          ) : null}
          <button onClick={() => onSchedule(post.id)} type="button">
            Schedule
          </button>
          <button onClick={() => onPublish(post.id)} type="button">
            Publish
          </button>
        </div>
      </div>
    </article>
  );
}

function EmptyQueue({ brandName, selectedPostCount }) {
  return (
    <div className="queue-empty">
      <strong>No scheduled posts yet</strong>
      <p>{brandName} has {selectedPostCount} reviewed drafts ready. Use Schedule selected when the set looks good.</p>
    </div>
  );
}

function QueueItem({ post }) {
  return (
    <div className="queue-item">
      <time>
        {post.date}
        <br />
        {post.time}
      </time>
      <div>
        <strong>{post.platformName}</strong>
        <p>
          {post.brandName} {post.media.toLowerCase()} queued for automatic publishing
        </p>
      </div>
      <span>{post.format}</span>
    </div>
  );
}

export default App;
