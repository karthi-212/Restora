const STORAGE_KEYS = {
  // Kept for graceful fallback if backend is not reachable
  MENU: "restora_menu",
  REVIEWS: "restora_reviews",
  RESERVATIONS: "restora_reservations",
};

// Use a relative API base so it works from any host (localhost or LAN IP)
const API_BASE = "/api";

function withTimeout(ms, fetchPromise) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetchPromise(controller.signal).finally(() => clearTimeout(timer));
}

async function apiGet(path, fallbackFn) {
  try {
    const res = await withTimeout(500, (signal) =>
      fetch(`${API_BASE}${path}`, { signal })
    );
    if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`API GET ${path} failed, falling back to local storage`, err);
    return fallbackFn ? fallbackFn() : null;
  }
}

async function apiPost(path, body, fallbackFn) {
  try {
    const res = await withTimeout(700, (signal) =>
      fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      })
    );
    if (!res.ok) throw new Error(`POST ${path} failed with ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`API POST ${path} failed, using local storage`, err);
    return fallbackFn ? fallbackFn() : null;
  }
}

async function apiDelete(path, fallbackFn) {
  try {
    const res = await withTimeout(500, (signal) =>
      fetch(`${API_BASE}${path}`, { method: "DELETE", signal })
    );
    if (!res.ok && res.status !== 204)
      throw new Error(`DELETE ${path} failed with ${res.status}`);
    return true;
  } catch (err) {
    console.warn(`API DELETE ${path} failed, using local storage`, err);
    return fallbackFn ? fallbackFn() : null;
  }
}

async function apiPatch(path, body, fallbackFn) {
  try {
    const res = await withTimeout(700, (signal) =>
      fetch(`${API_BASE}${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      })
    );
    if (!res.ok) throw new Error(`PATCH ${path} failed with ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`API PATCH ${path} failed, using local storage`, err);
    return fallbackFn ? fallbackFn() : null;
  }
}

const CURRENT_USER_KEY = "RestoraCurrentUser";

const createId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// Local default menu used only when backend is not reachable and local storage is empty
const defaultMenu = [
  {
    id: createId(),
    name: "Coq au Vin",
    price: 850,
    image:
      "https://raw.githubusercontent.com/karthi-212/Restora/refs/heads/main/assests/images/French%20Food%201.png",
    category: "Main Course",
  },
  {
    id: createId(),
    name: "Bouillabaisse",
    price: 1200,
    image:
      "https://raw.githubusercontent.com/karthi-212/Restora/refs/heads/main/assests/images/French%20Food%202.png",
    category: "Main Course",
  },
  {
    id: createId(),
    name: "Ratatouille",
    price: 650,
    image:
      "https://raw.githubusercontent.com/karthi-212/Restora/refs/heads/main/assests/images/French%20Food%203.png",
    category: "Vegetarian",
  },
  {
    id: createId(),
    name: "Escargot",
    price: 750,
    image:
      "https://raw.githubusercontent.com/karthi-212/Restora/refs/heads/main/assests/images/French%20Food%204.png",
    category: "Appetizer",
  },
  {
    id: createId(),
    name: "Crêpes",
    price: 450,
    image:
      "https://raw.githubusercontent.com/karthi-212/Restora/refs/heads/main/assests/images/French%20Food%205.png",
    category: "Dessert",
  },
  {
    id: createId(),
    name: "French Onion Soup",
    price: 420,
    image:
      "https://raw.githubusercontent.com/karthi-212/Restora/refs/heads/main/assests/images/French%20Food%206.png",
    category: "Soup",
  },
  {
    id: createId(),
    name: "Beef Bourguignon",
    price: 1100,
    image:
      "https://raw.githubusercontent.com/karthi-212/Restora/refs/heads/main/assests/images/French%20Food%207.png",
    category: "Main Course",
  },
];

const state = {
  menu: [],
  cart: new Map(),
  editingId: null,
  lastRenderedReviews: null, // Cache to prevent unnecessary re-renders
  isRenderingReviews: false, // Flag to prevent concurrent renders
  isSyncingReviews: false, // Flag to prevent rendering during sync
};

const els = {
  menuList: document.querySelector("#menuList"),
  cartList: document.querySelector("#cartList"),
  cartEmptyState: document.querySelector("#cartEmptyState"),
  subtotal: document.querySelector("#billSubtotal"),
  tax: document.querySelector("#billTax"),
  total: document.querySelector("#billTotal"),
  payNowBtn: document.querySelector("#payNowBtn"),
  clearCartBtn: document.querySelector("#clearCartBtn"),
  paymentArea: document.querySelector("#paymentArea"),
  printBillBtn: document.querySelector("#printBillBtn"),
  manageBtn: document.querySelector("#manageMenuBtn"),
  modal: document.querySelector("#manageModal"),
  closeModalBtn: document.querySelector("#closeModalBtn"),
  deleteItemBtn: document.querySelector("#deleteItemBtn"),
  form: document.querySelector("#menuForm"),
  itemId: document.querySelector("#itemId"),
  itemName: document.querySelector("#itemName"),
  itemPrice: document.querySelector("#itemPrice"),
  itemImage: document.querySelector("#itemImage"),
  itemCategory: document.querySelector("#itemCategory"),
  billTemplate: document.querySelector("#billTemplate"),
  writeReviewBtn: document.querySelector("#writeReviewBtn"),
  reviewModal: document.querySelector("#reviewModal"),
  closeReviewModalBtn: document.querySelector("#closeReviewModalBtn"),
  reviewForm: document.querySelector("#reviewForm"),
  reviewItemId: document.querySelector("#reviewItemId"),
  reviewRating: document.querySelector("#reviewRating"),
  reviewText: document.querySelector("#reviewText"),
  cancelReviewBtn: document.querySelector("#cancelReviewBtn"),
  reviewsList: document.querySelector("#reviewsList"),
  reviewsEmptyState: document.querySelector("#reviewsEmptyState"),
  starRating: document.querySelector("#starRating"),
  manageReviewsBtn: document.querySelector("#manageReviewsBtn"),
  manageReviewsModal: document.querySelector("#manageReviewsModal"),
  closeManageReviewsModalBtn: document.querySelector("#closeManageReviewsModalBtn"),
  manageReviewsList: document.querySelector("#manageReviewsList"),
  // User/profile
  userGreeting: document.querySelector("#userGreeting"),
  userNameDisplay: document.querySelector("#userNameDisplay"),
  userAvatarCircle: document.querySelector("#userAvatarCircle"),
  userAvatarInitials: document.querySelector("#userAvatarInitials"),
  openProfileBtn: document.querySelector("#openProfileBtn"),
  logoutBtn: document.querySelector("#logoutBtn"),
  profileModal: document.querySelector("#profileModal"),
  profileForm: document.querySelector("#profileForm"),
  profileName: document.querySelector("#profileName"),
  profileAvatarUrl: document.querySelector("#profileAvatarUrl"),
  profileEmail: document.querySelector("#profileEmail"),
  profileAvatarCircle: document.querySelector("#profileAvatarCircle"),
  profileAvatarInitials: document.querySelector("#profileAvatarInitials"),
  profileCancelBtn: document.querySelector("#profileCancelBtn"),
  closeProfileModalBtn: document.querySelector("#closeProfileModalBtn"),
  // Reservations
  reserveTableBtn: document.querySelector("#reserveTableBtn"),
  viewReservationsBtn: document.querySelector("#viewReservationsBtn"),
  reservationModal: document.querySelector("#reservationModal"),
  closeReservationModalBtn: document.querySelector("#closeReservationModalBtn"),
  reservationForm: document.querySelector("#reservationForm"),
  reservationName: document.querySelector("#reservationName"),
  reservationPhone: document.querySelector("#reservationPhone"),
  reservationDate: document.querySelector("#reservationDate"),
  reservationTime: document.querySelector("#reservationTime"),
  reservationGuests: document.querySelector("#reservationGuests"),
  reservationRequests: document.querySelector("#reservationRequests"),
  reservationMessage: document.querySelector("#reservationMessage"),
  cancelReservationBtn: document.querySelector("#cancelReservationBtn"),
  adminReservationsModal: document.querySelector("#adminReservationsModal"),
  closeAdminReservationsModalBtn: document.querySelector("#closeAdminReservationsModalBtn"),
  adminReservationsList: document.querySelector("#adminReservationsList"),
  reservationsCount: document.querySelector("#reservationsCount"),
  // New features
  menuSearch: document.querySelector("#menuSearch"),
  menuCategoryFilter: document.querySelector("#menuCategoryFilter"),
  orderHistoryBtn: document.querySelector("#orderHistoryBtn"),
  orderHistoryModal: document.querySelector("#orderHistoryModal"),
  closeOrderHistoryModalBtn: document.querySelector("#closeOrderHistoryModalBtn"),
  orderHistoryList: document.querySelector("#orderHistoryList"),
};

const printRoot = document.createElement("div");
printRoot.id = "printRoot";
document.body.appendChild(printRoot);

// Handle logout - clear current user and admin state, then go back to login page
if (els.logoutBtn) {
  els.logoutBtn.addEventListener("click", () => {
    try {
      localStorage.removeItem(CURRENT_USER_KEY);
    } catch (e) {
      console.warn("Unable to clear current user on logout", e);
    }
    try {
      localStorage.setItem("isAdmin", "false");
      sessionStorage.removeItem("isAdmin");
    } catch (e) {
      console.warn("Unable to clear admin status on logout", e);
    }
    // From "assests/main page/index.html" go back to the main login page at project root
    window.location.href = "../../index.html";
  });
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Unable to read current user", e);
    return null;
  }
}

function saveCurrentUser(user) {
  try {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn("Unable to save current user", e);
  }
}

function getInitials(name) {
  if (!name) return "R";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const second = parts[1]?.[0] || "";
  return (first + second).toUpperCase() || "R";
}

function applyUserToUI() {
  const user = getCurrentUser();
  const name = user?.name || "Guest";
  if (els.userGreeting) {
    els.userGreeting.textContent = user
      ? `Welcome, ${name}`
      : "Welcome to Restora";
  }
  if (els.userNameDisplay) {
    els.userNameDisplay.textContent = user ? name : "";
  }
  const initials = getInitials(name);
  if (els.userAvatarInitials) {
    els.userAvatarInitials.textContent = initials;
  }
  if (els.userAvatarCircle) {
    if (user?.avatarUrl) {
      els.userAvatarCircle.style.backgroundImage = `url('${user.avatarUrl}')`;
      els.userAvatarCircle.style.backgroundSize = "cover";
      els.userAvatarCircle.style.backgroundPosition = "center";
    } else {
      els.userAvatarCircle.style.backgroundImage = "none";
    }
  }
}


// Initialize - hide manage button by default, then check admin status
if (els.manageBtn) {
  els.manageBtn.style.display = "none";
}
if (els.manageReviewsBtn) {
  els.manageReviewsBtn.style.display = "none";
}

// Normalize admin flag once on load – if unset, default to "false"
try {
  const storedAdmin = localStorage.getItem("isAdmin");
  if (storedAdmin !== "true" && storedAdmin !== "false") {
    localStorage.setItem("isAdmin", "false");
  }
} catch (e) {
  console.warn("Could not normalize admin flag", e);
}

// Initial load – now async to prefer backend data when available
(async function init() {
  state.menu = await loadMenu();
  renderMenu();
  renderCart();
  renderReviews();
  applyUserToUI();

  // Check admin status after a small delay to ensure DOM is fully ready
  setTimeout(() => {
    checkAdminStatus();
  }, 100);

  // Also check immediately
  checkAdminStatus();
  
  // Set up periodic sync for all features (every 15 seconds) to catch changes from other devices
  // Increased interval to reduce flickering
  setInterval(() => {
    // Sync reviews (loadReviews will handle rendering if data changed)
    // Only sync if not currently rendering to prevent flickering
    if (!state.isRenderingReviews) {
      loadReviews().catch(err => {
        console.warn("Periodic review sync failed:", err);
      });
    }
    
    // Sync menu - preserve category filter
    loadMenu().then((menuData) => {
      const currentMenuIds = JSON.stringify(state.menu.map(m => m.id));
      const newMenuIds = JSON.stringify(menuData.map(m => m.id));
      
      if (currentMenuIds !== newMenuIds) {
        // Preserve category filter selection before rendering
        const preservedCategory = els.menuCategoryFilter?.value || "";
        state.menu = menuData;
        renderMenu();
        
        // Restore category filter after a brief delay to ensure DOM is updated
        if (preservedCategory && els.menuCategoryFilter) {
          setTimeout(() => {
            if (els.menuCategoryFilter) {
              // Check if the category still exists
              const optionExists = Array.from(els.menuCategoryFilter.options).some(
                opt => opt.value === preservedCategory
              );
              if (optionExists) {
                els.menuCategoryFilter.value = preservedCategory;
                // Re-apply filter
                filterMenu(els.menuSearch?.value || "", preservedCategory);
              }
            }
          }, 100);
        }
      }
    }).catch(err => {
      console.warn("Periodic menu sync failed:", err);
    });
  }, 10000); // Increased to 10 seconds to reduce flickering
  
  // Sync when page becomes visible (user switches back to tab)
  // Debounced to prevent multiple rapid syncs
  let visibilitySyncTimeout = null;
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      // Debounce visibility sync
      if (visibilitySyncTimeout) {
        clearTimeout(visibilitySyncTimeout);
      }
      visibilitySyncTimeout = setTimeout(() => {
        // Page became visible - sync all data
        // Only sync if not currently rendering to prevent flickering
        if (!state.isRenderingReviews) {
          loadReviews().catch(err => {
            console.warn("Visibility change review sync failed:", err);
          });
        }
        
        loadMenu().then((menuData) => {
          if (JSON.stringify(state.menu.map(m => m.id)) !== JSON.stringify(menuData.map(m => m.id))) {
            state.menu = menuData;
            renderMenu();
          }
        }).catch(err => {
          console.warn("Visibility change menu sync failed:", err);
        });
      }, 500); // 500ms debounce
    }
  });
  
  // Sync when window gains focus
  // Debounced to prevent multiple rapid syncs
  let focusSyncTimeout = null;
  window.addEventListener("focus", () => {
    if (focusSyncTimeout) {
      clearTimeout(focusSyncTimeout);
    }
    focusSyncTimeout = setTimeout(() => {
      // Only sync if not currently rendering to prevent flickering
      if (!state.isRenderingReviews) {
        loadReviews().catch(err => {
          console.warn("Focus review sync failed:", err);
        });
      }
      
      loadMenu().then((menuData) => {
        if (JSON.stringify(state.menu.map(m => m.id)) !== JSON.stringify(menuData.map(m => m.id))) {
          state.menu = menuData;
          renderMenu();
        }
      }).catch(err => {
        console.warn("Focus menu sync failed:", err);
      });
    }, 500); // 500ms debounce
  });
})();

els.manageBtn.addEventListener("click", () => openModal());

if (els.openProfileBtn && els.profileModal && els.profileForm) {
  els.openProfileBtn.addEventListener("click", () => {
    const user = getCurrentUser();
    const name = user?.name || "Guest";
    if (els.profileName) els.profileName.value = name;
    if (els.profileAvatarUrl) els.profileAvatarUrl.value = user?.avatarUrl || "";
    if (els.profileEmail) els.profileEmail.textContent = user?.email || "Not logged in";
    if (els.profileAvatarInitials) {
      els.profileAvatarInitials.textContent = getInitials(name);
    }
    if (els.profileAvatarCircle) {
      if (user?.avatarUrl) {
        els.profileAvatarCircle.style.backgroundImage = `url('${user.avatarUrl}')`;
        els.profileAvatarCircle.style.backgroundSize = "cover";
        els.profileAvatarCircle.style.backgroundPosition = "center";
      } else {
        els.profileAvatarCircle.style.backgroundImage = "none";
      }
    }
    els.profileModal.classList.remove("hidden");
  });

  if (els.closeProfileModalBtn) {
    els.closeProfileModalBtn.addEventListener("click", () => {
      els.profileModal.classList.add("hidden");
    });
  }

  if (els.profileCancelBtn) {
    els.profileCancelBtn.addEventListener("click", () => {
      els.profileModal.classList.add("hidden");
    });
  }

  els.profileModal.addEventListener("click", (evt) => {
    if (evt.target === els.profileModal) {
      els.profileModal.classList.add("hidden");
    }
  });

  els.profileForm.addEventListener("submit", (evt) => {
    evt.preventDefault();
    const user = getCurrentUser();
    if (!user) {
      alert("Please log in again to update your profile.");
      return;
    }
    const newName = els.profileName.value.trim() || user.name || "Guest";
    const newAvatarUrl = els.profileAvatarUrl.value.trim();
    const updatedUser = { ...user, name: newName, avatarUrl: newAvatarUrl };
    saveCurrentUser(updatedUser);

    // Also update stored users list if present
    try {
      const users = JSON.parse(localStorage.getItem("RestoraUsers")) || [];
      const idx = users.findIndex((u) => u.email === user.email);
      if (idx !== -1) {
        users[idx] = { ...users[idx], name: newName, avatarUrl: newAvatarUrl };
        localStorage.setItem("RestoraUsers", JSON.stringify(users));
      }
    } catch (e) {
      console.warn("Unable to update stored users with profile changes", e);
    }

    applyUserToUI();
    els.profileModal.classList.add("hidden");
  });
}

// Review button event listener - handle if button exists
if (els.writeReviewBtn) {
  els.writeReviewBtn.addEventListener("click", () => openReviewModal());
}

if (els.manageReviewsBtn) {
  els.manageReviewsBtn.addEventListener("click", () => {
    renderManageReviewsList();
    openManageReviewsModal();
  });
}

if (els.closeManageReviewsModalBtn) {
  els.closeManageReviewsModalBtn.addEventListener("click", closeManageReviewsModal);
}

if (els.manageReviewsModal) {
  els.manageReviewsModal.addEventListener("click", (evt) => {
    if (evt.target === els.manageReviewsModal) closeManageReviewsModal();
  });
}

if (els.closeReviewModalBtn) {
  els.closeReviewModalBtn.addEventListener("click", closeReviewModal);
}

if (els.cancelReviewBtn) {
  els.cancelReviewBtn.addEventListener("click", closeReviewModal);
}

if (els.reviewModal) {
  els.reviewModal.addEventListener("click", (evt) => {
    if (evt.target === els.reviewModal) closeReviewModal();
  });
}

// Star rating interaction - will be set up when modal opens
function setupStarRating() {
  if (!els.starRating) return;
  
  // Remove existing listeners by cloning
  const newStarRating = els.starRating.cloneNode(true);
  els.starRating.parentNode.replaceChild(newStarRating, els.starRating);
  els.starRating = newStarRating;
  
  els.starRating.querySelectorAll(".star").forEach((star) => {
    star.addEventListener("click", () => {
      const rating = parseInt(star.dataset.rating);
      setStarRating(rating);
    });
    star.addEventListener("mouseenter", () => {
      const rating = parseInt(star.dataset.rating);
      highlightStars(rating);
    });
  });
  els.starRating.addEventListener("mouseleave", () => {
    const currentRating = parseInt(els.reviewRating.value) || 0;
    highlightStars(currentRating);
  });
}

if (els.reviewForm) {
  els.reviewForm.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    
    if (!els.reviewItemId || !els.reviewRating || !els.reviewText) {
      console.error("Review form elements not found");
      alert("Error: Review form not properly initialized. Please refresh the page.");
      return;
    }
    
    const currentUser = getCurrentUser();
    const itemId = els.reviewItemId.value;
    const menuItem = state.menu.find((item) => item.id === itemId);
    const itemName = menuItem?.name || "Unknown";
    
    const reviewData = {
      id: createId(),
      itemId: itemId,
      itemName: itemName,
      rating: parseInt(els.reviewRating.value),
      reviewerName: currentUser?.name || "Anonymous",
      text: els.reviewText.value.trim(),
      timestamp: Date.now(),
    };

    if (!reviewData.itemId || !reviewData.rating || reviewData.rating === 0 || !reviewData.text) {
      alert("Please select a rating (1-5 stars) and write your review.");
      return;
    }

    // Load reviews from localStorage (reliable source)
    const saved = localStorage.getItem(STORAGE_KEYS.REVIEWS);
    let reviews = [];
    if (saved) {
      try {
        reviews = JSON.parse(saved) || [];
        if (!Array.isArray(reviews)) {
          reviews = [];
        }
      } catch (e) {
        console.error("Failed to parse reviews:", e);
        reviews = [];
      }
    }
    
    // Check if review already exists (prevent duplicates)
    const existingIndex = reviews.findIndex(r => r.id === reviewData.id);
    if (existingIndex === -1) {
      // Add new review only if it doesn't exist
      reviews.push(reviewData);
    } else {
      // Update existing review
      reviews[existingIndex] = reviewData;
    }
    
    // Deduplicate by ID before saving
    const seenIds = new Set();
    const uniqueReviews = [];
    reviews.forEach(review => {
      if (review.id && !seenIds.has(review.id)) {
        seenIds.add(review.id);
        uniqueReviews.push(review);
      }
    });
    reviews = uniqueReviews;
    
    // Save immediately to localStorage (reliable storage)
    try {
      localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(reviews));
      console.log("Review saved successfully to localStorage");
    } catch (e) {
      console.error("Failed to save review:", e);
      alert("Error: Could not save review. Please try again.");
      return;
    }
    
    // Clear cache before rendering
    state.lastRenderedReviews = null;
    
    // Render immediately with local data
    renderReviews();
    renderMenu(); // Update menu to show new ratings
    closeReviewModal();
    
    // Sync to backend in background (non-blocking)
    // Don't reload immediately to prevent duplicate rendering
    apiPost("/reviews", {
      itemId: reviewData.itemId,
      itemName: reviewData.itemName,
      rating: reviewData.rating,
      reviewerName: reviewData.reviewerName,
      text: reviewData.text,
    }).then((savedReview) => {
      // If backend returns a review with different ID, update local storage
      if (savedReview && savedReview.id && savedReview.id !== reviewData.id) {
        // Update the review ID in localStorage
        const saved = localStorage.getItem(STORAGE_KEYS.REVIEWS);
        if (saved) {
          try {
            const reviews = JSON.parse(saved) || [];
            const index = reviews.findIndex(r => r.id === reviewData.id);
            if (index !== -1) {
              reviews[index] = { ...reviews[index], ...savedReview, itemName: reviewData.itemName };
              localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(reviews));
            }
          } catch (e) {
            console.error("Failed to update review ID:", e);
          }
        }
      }
      
      // Only reload after a longer delay to prevent duplicate rendering
      // The review is already displayed from local storage
      setTimeout(() => {
        loadReviews();
      }, 1500);
    }).catch(err => {
      console.warn("Background sync failed, but review is saved locally:", err);
    });
  });
} else {
  console.warn("Review form not found");
}
els.closeModalBtn.addEventListener("click", closeModal);
els.modal.addEventListener("click", (evt) => {
  if (evt.target === els.modal) closeModal();
});

els.form.addEventListener("submit", (evt) => {
  evt.preventDefault();
  const formData = {
    id: els.itemId.value || createId(),
    name: els.itemName.value.trim(),
    price: Number(els.itemPrice.value),
    image: els.itemImage.value.trim() || getPlaceholderImage(),
    category: els.itemCategory.value.trim() || "Specials",
  };

  if (!formData.name || formData.price <= 0) return;

  const existingIndex = state.menu.findIndex((item) => item.id === formData.id);
  if (existingIndex >= 0) {
    state.menu[existingIndex] = formData;
  } else {
    state.menu.push(formData);
  }

  persistMenu();
  renderMenu();
  closeModal();
});

els.deleteItemBtn.addEventListener("click", () => {
  const id = els.itemId.value;
  if (!id) return;
  state.menu = state.menu.filter((item) => item.id !== id);
  persistMenu();
  renderMenu();
  closeModal();
});

els.clearCartBtn.addEventListener("click", () => {
  state.cart.clear();
  els.paymentArea.classList.add("hidden");
  renderCart();
});

els.payNowBtn.addEventListener("click", handlePayment);
els.printBillBtn.addEventListener("click", () => {
  window.print();
});

// Reservation event listeners
if (els.reserveTableBtn) {
  els.reserveTableBtn.addEventListener("click", openReservationModal);
}

if (els.closeReservationModalBtn) {
  els.closeReservationModalBtn.addEventListener("click", closeReservationModal);
}

if (els.cancelReservationBtn) {
  els.cancelReservationBtn.addEventListener("click", closeReservationModal);
}

if (els.reservationModal) {
  els.reservationModal.addEventListener("click", (evt) => {
    if (evt.target === els.reservationModal) {
      closeReservationModal();
    }
  });
}

if (els.reservationForm) {
  els.reservationForm.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    if (!els.reservationName || !els.reservationPhone || !els.reservationDate || !els.reservationTime || !els.reservationGuests) {
      alert("Please fill in all required fields.");
      return;
    }

    const user = getCurrentUser();
    const reservation = {
      id: createId(),
      name: els.reservationName.value.trim(),
      phone: els.reservationPhone.value.trim(),
      date: els.reservationDate.value,
      time: els.reservationTime.value,
      guests: Number(els.reservationGuests.value || 0),
      notes: els.reservationRequests ? els.reservationRequests.value.trim() : "",
      requests: els.reservationRequests ? els.reservationRequests.value.trim() : "", // Keep for display
      userEmail: user?.email || null,
      createdAt: Date.now(),
      status: "pending",
    };

    if (!reservation.name || !reservation.phone || !reservation.date || !reservation.time || !reservation.guests) {
      alert("Please fill in all required fields.");
      return;
    }

    // Save locally first (immediate)
    await saveReservation(reservation);

    // Refresh admin reservations list if admin modal is open - use requestAnimationFrame to prevent flickering
    if (isAdmin() && els.adminReservationsModal && !els.adminReservationsModal.classList.contains("hidden")) {
      requestAnimationFrame(() => {
        renderAdminReservations();
      });
    }

    if (els.reservationMessage) {
      els.reservationMessage.textContent = "Your table has been reserved successfully!";
      els.reservationMessage.classList.remove("hidden");
    }

    // Reset form but keep name
    const nameValue = els.reservationName.value;
    els.reservationForm.reset();
    els.reservationName.value = nameValue;

    // Close modal after 2 seconds
    setTimeout(() => {
      closeReservationModal();
    }, 2000);
  });
}

// Admin reservations event listeners
if (els.viewReservationsBtn) {
  els.viewReservationsBtn.addEventListener("click", openAdminReservationsModal);
}

if (els.closeAdminReservationsModalBtn) {
  els.closeAdminReservationsModalBtn.addEventListener("click", closeAdminReservationsModal);
}

if (els.adminReservationsModal) {
  els.adminReservationsModal.addEventListener("click", (evt) => {
    if (evt.target === els.adminReservationsModal) {
      closeAdminReservationsModal();
    }
  });
}

async function loadMenu() {
  // 1) Instant local/default menu
  let local = [];
  const saved = localStorage.getItem(STORAGE_KEYS.MENU);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) {
        local = parsed;
      }
    } catch {
      console.warn("Failed to parse menu storage");
    }
  }
  if (!local.length) {
    local = [...defaultMenu];
    localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(local));
  }

  // 2) Background refresh from backend to keep devices in sync
  // Backend is source of truth for menu items
  apiGet("/menu", () => null).then((serverMenu) => {
    if (Array.isArray(serverMenu)) {
      // Use backend as source of truth - sync deletions and additions
      localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(serverMenu));
      state.menu = serverMenu;
      renderMenu();
    }
  }).catch(err => {
    console.warn("Menu sync failed (using local data):", err);
  });

  return local;
}

async function persistMenu() {
  // Sync changes to backend (using query param ids) and keep local copy
  try {
    const existing = await apiGet("/menu", () => []);
    const byId = new Map((existing || []).map((m) => [m.id, m]));
    for (const item of state.menu) {
      if (byId.has(item.id)) {
        await apiPatch(`/menu?id=${encodeURIComponent(item.id)}`, item, () => null);
      } else {
        await apiPost("/menu", item, () => null);
      }
    }
  } catch (e) {
    console.warn("Unable to sync menu to backend", e);
  }
  localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(state.menu));
}

function isAdmin() {
  try {
    const localStorageAdmin = localStorage.getItem("isAdmin");
    const sessionStorageAdmin = sessionStorage.getItem("isAdmin");
    return localStorageAdmin === "true" || sessionStorageAdmin === "true";
  } catch (e) {
    return false;
  }
}

async function renderMenu() {
  if (!els.menuList) {
    console.error("Menu list element not found!");
    return;
  }
  
  if (!state.menu || state.menu.length === 0) {
    console.warn("Menu is empty!");
    els.menuList.innerHTML = "<p class='empty-state'>No menu items available.</p>";
    // Update category filter even if menu is empty - preserve current selection
    if (els.menuCategoryFilter) {
      const currentValue = els.menuCategoryFilter.value;
      els.menuCategoryFilter.innerHTML = '<option value="">All Categories</option>';
      if (currentValue) {
        // Try to preserve selection if possible
        try {
          els.menuCategoryFilter.value = currentValue;
        } catch (e) {
          // Selection doesn't exist anymore, ignore
        }
      }
    }
    return;
  }
  
  els.menuList.innerHTML = "";
  const adminLoggedIn = isAdmin();
  const currentUser = getCurrentUser();
  const favoriteIds = Array.isArray(currentUser?.favorites)
    ? new Set(currentUser.favorites)
    : new Set();
  
  // Load reviews from localStorage for menu ratings (reliable source)
  // Don't call loadReviews() here as it triggers sync and can cause duplicate renders
  const reviewsSaved = localStorage.getItem(STORAGE_KEYS.REVIEWS);
  let reviewsForMenu = [];
  if (reviewsSaved) {
    try {
      reviewsForMenu = JSON.parse(reviewsSaved) || [];
      if (!Array.isArray(reviewsForMenu)) {
        reviewsForMenu = [];
      }
      
      // Deduplicate reviews by ID to prevent duplicate ratings
      const seenIds = new Set();
      const uniqueReviews = [];
      reviewsForMenu.forEach(review => {
        if (review.id && !seenIds.has(review.id)) {
          seenIds.add(review.id);
          uniqueReviews.push(review);
        }
      });
      reviewsForMenu = uniqueReviews;
    } catch (e) {
      console.warn("Failed to parse reviews for menu:", e);
      reviewsForMenu = [];
    }
  }
  
  state.menu.forEach((item) => {
    const card = document.createElement("article");
    card.className = "menu-card";
    
    // Calculate average rating for this item
    // Filter reviews for this item and ensure no duplicates
    const itemReviewsMap = new Map();
    reviewsForMenu.forEach(review => {
      if (review.itemId === item.id && review.id) {
        // Use the most recent review if duplicates exist (shouldn't happen after deduplication above)
        if (!itemReviewsMap.has(review.id)) {
          itemReviewsMap.set(review.id, review);
        }
      }
    });
    const itemReviews = Array.from(itemReviewsMap.values());
    
    const avgRating = itemReviews.length > 0
      ? itemReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / itemReviews.length
      : 0;
    const ratingStars = avgRating > 0 ? getRatingStars(avgRating) : '';
    const isFavorite = favoriteIds.has(item.id);
    
    card.innerHTML = `
      <img src="${item.image}" alt="${item.name}" />
      <h3>${item.name}</h3>
      <p>${item.category}</p>
      <strong>₹${item.price}</strong>
      ${avgRating > 0 ? `<div class="item-rating">${ratingStars} <span class="rating-value">(${avgRating.toFixed(1)})</span></div>` : ''}
      <div class="menu-actions">
        <button class="btn primary" data-action="add">Add</button>
        <button class="icon-btn favorite-btn ${isFavorite ? "favorite-btn--active" : ""}" data-action="favorite" aria-label="Add to favourites">
          ${isFavorite ? "♥" : "♡"}
        </button>
        ${adminLoggedIn ? '<button class="btn ghost" data-action="edit">Edit</button>' : ''}
      </div>
    `;
    card.querySelector('[data-action="add"]').addEventListener("click", () =>
      addToCart(item.id)
    );
    const favBtn = card.querySelector('[data-action="favorite"]');
    if (favBtn) {
      favBtn.addEventListener("click", () => toggleFavorite(item.id));
    }
    const editBtn = card.querySelector('[data-action="edit"]');
    if (editBtn) {
      editBtn.addEventListener("click", () =>
        openModal(item.id)
      );
    }
    els.menuList.appendChild(card);
  });
  
  // Update category filter after rendering menu - preserve selected value
  if (els.menuCategoryFilter && state.menu) {
    const currentValue = els.menuCategoryFilter.value; // Preserve current selection
    const categories = [...new Set(state.menu.map(item => item.category).filter(Boolean))];
    categories.sort(); // Sort alphabetically
    
    // Only update if filter is not locked (user is actively using it)
    if (!categoryFilterLocked) {
      els.menuCategoryFilter.innerHTML = '<option value="">All Categories</option>';
      categories.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat;
        option.textContent = cat;
        els.menuCategoryFilter.appendChild(option);
      });
      
      // Restore previous selection if it still exists
      if (currentValue && categories.includes(currentValue)) {
        els.menuCategoryFilter.value = currentValue;
        // Re-apply filter
        filterMenu(els.menuSearch?.value || "", currentValue);
      }
    } else {
      // Filter is locked, just ensure the selected option exists
      const optionExists = Array.from(els.menuCategoryFilter.options).some(
        opt => opt.value === currentValue
      );
      if (!optionExists && currentValue) {
        // Option doesn't exist, add it
        const option = document.createElement("option");
        option.value = currentValue;
        option.textContent = currentValue;
        els.menuCategoryFilter.appendChild(option);
        els.menuCategoryFilter.value = currentValue;
      }
    }
  }
}

function toggleFavorite(itemId) {
  const user = getCurrentUser();
  if (!user || !user.email) {
    alert("Please log in to save favourites.");
    return;
  }

  const favourites = Array.isArray(user.favorites) ? [...user.favorites] : [];
  const idx = favourites.indexOf(itemId);
  if (idx === -1) {
    favourites.push(itemId);
  } else {
    favourites.splice(idx, 1);
  }

  const updatedUser = { ...user, favorites: favourites };
  saveCurrentUser(updatedUser);

  // Also update stored users list if present
  try {
    const users = JSON.parse(localStorage.getItem("RestoraUsers")) || [];
    const userIndex = users.findIndex((u) => u.email === user.email);
    if (userIndex !== -1) {
      users[userIndex] = { ...users[userIndex], favorites: favourites };
      localStorage.setItem("RestoraUsers", JSON.stringify(users));
    }
  } catch (e) {
    console.warn("Unable to sync favourites to stored users", e);
  }

  // Re-render menu so favourite state updates
  renderMenu();
}

function addToCart(id) {
  const item = state.menu.find((menuItem) => menuItem.id === id);
  if (!item) return;
  const existing = state.cart.get(id) || { ...item, qty: 0 };
  existing.qty += 1;
  state.cart.set(id, existing);
  renderCart();
}

function renderCart() {
  const entries = Array.from(state.cart.values());
  if (!entries.length) {
    els.cartEmptyState.classList.remove("hidden");
    els.cartList.innerHTML = "";
  } else {
    els.cartEmptyState.classList.add("hidden");
    els.cartList.innerHTML = entries
      .map(
        (item) => `
        <div class="cart-item">
          <div>
            <span>${item.name}</span>
            <small>₹${item.price} × ${item.qty}</small>
          </div>
          <div>
            <button class="icon-btn" data-action="dec" data-id="${item.id}">−</button>
            <button class="icon-btn" data-action="inc" data-id="${item.id}">+</button>
          </div>
        </div>
      `
      )
      .join("");
    els.cartList
      .querySelectorAll("button")
      .forEach((btn) =>
        btn.addEventListener("click", () =>
          updateCartQuantity(btn.dataset.id, btn.dataset.action)
        )
      );
  }
  updateBill(entries);
}

function updateCartQuantity(id, action) {
  const entry = state.cart.get(id);
  if (!entry) return;
  if (action === "inc") entry.qty += 1;
  if (action === "dec") entry.qty -= 1;
  if (entry.qty <= 0) state.cart.delete(id);
  renderCart();
}

function updateBill(entries) {
  const subtotal = entries.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );
  const tax = subtotal * 0.05;
  const total = subtotal + tax;
  els.subtotal.textContent = formatCurrency(subtotal);
  els.tax.textContent = formatCurrency(tax);
  els.total.textContent = formatCurrency(total);
}

async function handlePayment() {
  if (!state.cart.size) return;
  const entries = Array.from(state.cart.values());
  const subtotal = entries.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );
  const tax = subtotal * 0.05;
  const total = subtotal + tax;
  
  // Save order to database
  const currentUser = getCurrentUser();
  let orderSaved = false;
  try {
    const orderData = {
      userId: currentUser?.email || null,
      items: entries.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: item.qty,
      })),
      subtotal,
      tax,
      total,
      paymentMethod: "online",
    };
    
    const savedOrder = await apiPost("/orders", orderData, () => {
      console.warn("Failed to save order to database, but continuing with payment");
      return null;
    });
    
    if (savedOrder) {
      console.log("Order saved successfully:", savedOrder.id);
      orderSaved = true;
      
      // Refresh order history if modal is open
      if (els.orderHistoryModal && !els.orderHistoryModal.classList.contains("hidden")) {
        setTimeout(() => {
          loadOrderHistory();
        }, 500);
      }
      
    }
  } catch (err) {
    console.error("Error saving order:", err);
    // Continue with payment even if save fails
  }
  
  populatePrintArea(entries, total);
  els.paymentArea.classList.remove("hidden");
  state.cart.clear();
  renderCart();
  
  // Show "Ordered" popup after 2 seconds (after QR code is displayed)
  if (orderSaved) {
    setTimeout(() => {
      const orderedMsg = document.createElement("div");
      orderedMsg.className = "success-message";
      orderedMsg.textContent = "Ordered!";
      orderedMsg.style.fontSize = "1.5rem";
      orderedMsg.style.fontWeight = "bold";
      document.body.appendChild(orderedMsg);
      setTimeout(() => {
        orderedMsg.classList.add("show");
      }, 10);
      setTimeout(() => {
        orderedMsg.classList.remove("show");
        setTimeout(() => orderedMsg.remove(), 300);
      }, 3000);
    }, 2000);
  }
}


function openModal(id) {
  if (id) {
    const item = state.menu.find((menuItem) => menuItem.id === id);
    if (!item) return;
    els.itemId.value = item.id;
    els.itemName.value = item.name;
    els.itemPrice.value = item.price;
    els.itemImage.value = item.image;
    els.itemCategory.value = item.category;
    els.deleteItemBtn.disabled = false;
  } else {
    els.form.reset();
    els.itemId.value = "";
    els.itemImage.value = "";
    els.deleteItemBtn.disabled = true;
  }
  els.modal.classList.remove("hidden");
}

function closeModal() {
  els.modal.classList.add("hidden");
}

function getPlaceholderImage() {
  return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=60";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(value);
}

function populatePrintArea(entries, total) {
  printRoot.innerHTML = "";
  const clone = els.billTemplate.content.cloneNode(true);
  const itemsBody = clone.querySelector("#billItems");
  const subtotal = entries.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );
  const tax = subtotal * 0.05;
  const grandTotal = subtotal + tax;
  entries.forEach((entry) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.name}</td>
      <td>${entry.qty}</td>
      <td>${formatCurrency(entry.price * entry.qty)}</td>
    `;
    itemsBody.appendChild(row);
  });
  const subtotalEl = clone.querySelector("#billSubtotalPrint");
  const taxEl = clone.querySelector("#billTaxPrint");
  const totalEl = clone.querySelector("#billTotalPrint");
  if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
  if (taxEl) taxEl.textContent = formatCurrency(tax);
  if (totalEl) totalEl.textContent = formatCurrency(grandTotal);
  clone.querySelector(
    "#billTimestamp"
  ).textContent = `Date: ${new Date().toLocaleString()}`;
  printRoot.appendChild(clone);
}


// Reservation functions
async function loadReservations() {
  // Always return local data first (local-first approach)
  const raw = localStorage.getItem(STORAGE_KEYS.RESERVATIONS);
  let local = [];
  if (raw) {
    try {
      local = JSON.parse(raw) || [];
      if (!Array.isArray(local)) {
        local = [];
      }
    } catch {
      local = [];
    }
  }

  // Background sync from backend - merge intelligently (don't overwrite local)
  apiGet("/reservations", () => null).then((serverData) => {
    if (Array.isArray(serverData) && serverData.length > 0) {
      // Merge: combine local and server data, preferring server for conflicts
      const localMap = new Map(local.map(r => [r.id, r]));
      const serverMap = new Map(serverData.map(r => [r.id, r]));
      
      // Start with server data (source of truth)
      const merged = [...serverData];
      
      // Add any local reservations that don't exist on server (pending sync)
      local.forEach(localRes => {
        if (!serverMap.has(localRes.id)) {
          // Check if it's recent (within last 5 minutes) - might be pending sync
          const isRecent = localRes.createdAt && (Date.now() - localRes.createdAt < 300000);
          if (isRecent) {
            merged.push(localRes);
          }
        }
      });
      
      // Update localStorage with merged data
      localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify(merged));
      
      // Refresh admin view if open - use requestAnimationFrame to prevent flickering
      if (isAdmin() && els.adminReservationsModal && !els.adminReservationsModal.classList.contains("hidden")) {
        requestAnimationFrame(() => {
          renderAdminReservations();
        });
      }
    }
  }).catch(err => {
    console.warn("Reservation sync failed (using local data):", err);
  });

  return local;
}

async function saveReservation(reservation) {
  // STEP 1: Save to local storage FIRST (immediate, reliable)
  const saved = localStorage.getItem(STORAGE_KEYS.RESERVATIONS);
  let local = [];
  if (saved) {
    try {
      local = JSON.parse(saved) || [];
      if (!Array.isArray(local)) {
        local = [];
      }
    } catch {
      local = [];
    }
  }
  
  // Check if reservation already exists (avoid duplicates)
  const exists = local.some(r => r.id === reservation.id);
  if (!exists) {
    local.push(reservation);
    localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify(local));
    console.log("Reservation saved locally:", reservation.id);
  }
  
  // STEP 2: Sync to backend (non-blocking, background)
  // Prepare data for backend (ensure all required fields)
  const backendReservation = {
    id: reservation.id,
    name: reservation.name,
    phone: reservation.phone || "",
    date: reservation.date,
    time: reservation.time,
    guests: reservation.guests,
    notes: reservation.notes || reservation.requests || "",
    userEmail: reservation.userEmail || null,
  };
  
  apiPost("/reservations", backendReservation, () => {
    console.warn("Backend reservation save failed, but saved locally");
    return null;
  }).then((savedReservation) => {
    console.log("Reservation synced to backend:", savedReservation?.id || reservation.id);
    // After successful backend save, refresh from backend to get server confirmation
    setTimeout(() => {
      loadReservations().then(() => {
        // Refresh admin view if it's open - use requestAnimationFrame to prevent flickering
        if (isAdmin() && els.adminReservationsModal && !els.adminReservationsModal.classList.contains("hidden")) {
          requestAnimationFrame(() => {
            renderAdminReservations();
          });
        }
      });
    }, 500);
  }).catch(err => {
    console.warn("Backend sync failed, but reservation is saved locally:", err);
    // Reservation is still available locally, so it will show up
  });
}

function openReservationModal() {
  if (!els.reservationModal || !els.reservationForm) return;
  
  // Prefill name from current user if available
  const currentUser = getCurrentUser();
  if (currentUser && els.reservationName) {
    els.reservationName.value = currentUser.name || "";
  }
  
  // Set default date to today
  if (els.reservationDate) {
    const today = new Date().toISOString().split('T')[0];
    els.reservationDate.value = today;
    els.reservationDate.min = today; // Prevent selecting past dates
  }
  
  // Reset form
  els.reservationForm.reset();
  if (currentUser && els.reservationName) {
    els.reservationName.value = currentUser.name || "";
  }
  if (els.reservationDate) {
    const today = new Date().toISOString().split('T')[0];
    els.reservationDate.value = today;
    els.reservationDate.min = today;
  }
  if (els.reservationMessage) {
    els.reservationMessage.classList.add("hidden");
    els.reservationMessage.textContent = "";
  }
  
  els.reservationModal.classList.remove("hidden");
}

function closeReservationModal() {
  if (els.reservationModal) {
    els.reservationModal.classList.add("hidden");
  }
}

async function updateReservationStatus(id, status) {
  if (!id || !status) return;
  
  // Update in localStorage
  const raw = localStorage.getItem(STORAGE_KEYS.RESERVATIONS);
  let reservations = [];
  if (raw) {
    try {
      reservations = JSON.parse(raw) || [];
      if (!Array.isArray(reservations)) {
        reservations = [];
      }
    } catch {
      reservations = [];
    }
  }
  
  const index = reservations.findIndex(r => r.id === id);
  if (index !== -1) {
    reservations[index] = { ...reservations[index], status };
    localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify(reservations));
  }
  
  // Sync to backend
  apiPatch(`/reservations?id=${encodeURIComponent(id)}`, { status }, () => {
    console.warn("Backend status update failed, but updated locally");
    return null;
  }).catch(err => {
    console.warn("Backend status update error:", err);
  });
  
  // Refresh the view - use requestAnimationFrame to prevent flickering
  requestAnimationFrame(() => {
    renderAdminReservations();
  });
}

async function deleteReservation(id) {
  if (!id || !confirm("Are you sure you want to delete this reservation? This action cannot be undone.")) return;
  
  // Remove from localStorage
  const raw = localStorage.getItem(STORAGE_KEYS.RESERVATIONS);
  let reservations = [];
  if (raw) {
    try {
      reservations = JSON.parse(raw) || [];
      if (!Array.isArray(reservations)) {
        reservations = [];
      }
    } catch {
      reservations = [];
    }
  }
  
  reservations = reservations.filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify(reservations));
  
  // Also delete from backend
  apiDelete(`/reservations?id=${encodeURIComponent(id)}`, () => {
    console.warn("Backend deletion failed, but deleted locally");
    return null;
  }).catch(err => {
    console.warn("Backend deletion error:", err);
  });
  
  // Refresh the view - use requestAnimationFrame to prevent flickering
  requestAnimationFrame(() => {
    renderAdminReservations();
  });
}

// Track last rendered reservations to prevent unnecessary re-renders
let lastRenderedReservations = null;

async function renderAdminReservations() {
  if (!els.adminReservationsList) return;

  // Load fresh data from localStorage (local-first, most up-to-date)
  const raw = localStorage.getItem(STORAGE_KEYS.RESERVATIONS);
  let reservations = [];
  if (raw) {
    try {
      reservations = JSON.parse(raw) || [];
      if (!Array.isArray(reservations)) {
        reservations = [];
      }
    } catch (e) {
      console.error("Failed to parse reservations:", e);
      reservations = [];
    }
  }

  // Check if data actually changed to prevent unnecessary re-renders
  const reservationsKey = JSON.stringify(reservations.map(r => ({ id: r.id, status: r.status })));
  if (lastRenderedReservations === reservationsKey) {
    // Data hasn't changed, skip re-render to prevent flickering
    return;
  }
  lastRenderedReservations = reservationsKey;

  // Trigger background sync from backend (non-blocking, but don't re-render immediately)
  loadReservations().catch(err => {
    console.warn("Background reservation sync failed:", err);
  });

  console.log("Rendering reservations:", reservations.length, "found");

  // Update count
  if (els.reservationsCount) {
    els.reservationsCount.textContent = reservations.length;
  }

  if (!reservations.length) {
    els.adminReservationsList.innerHTML =
      '<p class="empty-state">No reservations yet.</p>';
    return;
  }

  const sorted = [...reservations].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );

  els.adminReservationsList.innerHTML = sorted
    .map((res) => {
      const created = res.createdAt
        ? new Date(res.createdAt).toLocaleString()
        : "–";
      const date = res.date || "–";
      const time = res.time || "–";
      const guests = res.guests || 0;
      const phone = res.phone || "Not provided";
      const requests = res.requests || res.notes || "None";
      const status = res.status || "pending";
      
      // Status badge styling
      const statusClass = status === "approved" ? "res-status--approved" : 
                         status === "rejected" ? "res-status--rejected" : 
                         "res-status--pending";
      const statusLabel = status === "approved" ? "Confirmed" : 
                         status === "rejected" ? "Cancelled" : 
                         "Pending";

      // Action buttons based on status
      let actionButtons = '';
      if (status === "pending") {
        actionButtons = `
          <button class="btn primary small-btn accept-reservation-btn" data-id="${res.id}" title="Accept reservation">
            ✓ Accept
          </button>
          <button class="btn reject-btn small-btn reject-reservation-btn" data-id="${res.id}" title="Reject reservation">
            ✕ Reject
          </button>
        `;
      } else if (status === "approved") {
        actionButtons = `
          <button class="btn reject-btn small-btn reject-reservation-btn" data-id="${res.id}" title="Reject reservation">
            ✕ Reject
          </button>
        `;
      } else if (status === "rejected") {
        actionButtons = `
          <button class="btn primary small-btn accept-reservation-btn" data-id="${res.id}" title="Accept reservation">
            ✓ Accept
          </button>
        `;
      }

      return `
        <article class="admin-res-card">
          <header class="admin-res-header">
            <div>
              <h3>${escapeHtml(res.name || "Guest")}</h3>
              <p>Date: ${date} · Time: ${time} · Guests: ${guests}</p>
            </div>
            <span class="res-status ${statusClass}">${statusLabel}</span>
          </header>
          <div class="admin-res-body">
            <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
            <p><strong>Special Requests:</strong> ${escapeHtml(requests)}</p>
            ${res.userEmail ? `<p><strong>Email:</strong> ${escapeHtml(res.userEmail)}</p>` : ""}
          </div>
          <footer class="admin-res-footer">
            <span class="admin-res-created">Reserved: ${created}</span>
            <div class="admin-res-actions">
              ${actionButtons}
              <button class="btn delete-btn small-btn delete-reservation-btn" data-id="${res.id}" title="Delete reservation">
                🗑️ Delete
              </button>
            </div>
          </footer>
        </article>
      `;
    })
    .join("");
  
  // Add event listeners for action buttons
  els.adminReservationsList.querySelectorAll(".delete-reservation-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (id) {
        deleteReservation(id);
      }
    });
  });
  
  els.adminReservationsList.querySelectorAll(".accept-reservation-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (id) {
        updateReservationStatus(id, "approved");
      }
    });
  });
  
  els.adminReservationsList.querySelectorAll(".reject-reservation-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (id) {
        if (confirm("Are you sure you want to reject this reservation?")) {
          updateReservationStatus(id, "rejected");
        }
      }
    });
  });
}

async function openAdminReservationsModal() {
  if (!els.adminReservationsModal) return;
  // Refresh data before opening
  await loadReservations();
  // Reset last rendered state to force initial render
  lastRenderedReservations = null;
  renderAdminReservations();
  els.adminReservationsModal.classList.remove("hidden");
  
  // Set up periodic refresh while modal is open (every 3 seconds)
  // Clear any existing interval
  if (window.adminReservationsRefreshInterval) {
    clearInterval(window.adminReservationsRefreshInterval);
    window.adminReservationsRefreshInterval = null;
  }
  
  // Only refresh if modal is open, and use a longer interval to prevent flickering
  // Also use debouncing to prevent rapid re-renders
  let isRendering = false;
  window.adminReservationsRefreshInterval = setInterval(() => {
    if (els.adminReservationsModal && !els.adminReservationsModal.classList.contains("hidden")) {
      // Prevent concurrent renders
      if (!isRendering) {
        isRendering = true;
        // Only refresh data, don't force re-render if nothing changed
        loadReservations().then(() => {
          isRendering = false;
        }).catch(() => {
          isRendering = false;
        });
      }
    } else {
      clearInterval(window.adminReservationsRefreshInterval);
      window.adminReservationsRefreshInterval = null;
    }
  }, 10000); // Increased to 10 seconds to reduce flickering
}

function closeAdminReservationsModal() {
  if (els.adminReservationsModal) {
    els.adminReservationsModal.classList.add("hidden");
  }
  // Clear refresh interval when modal closes
  if (window.adminReservationsRefreshInterval) {
    clearInterval(window.adminReservationsRefreshInterval);
    window.adminReservationsRefreshInterval = null;
  }
}

function checkAdminStatus() {
  if (!els.manageBtn) {
    console.warn("Manage button not found");
    return;
  }
  
  // Check admin status from storage only (login page controls this)
  let localStorageAdmin = null;
  let sessionStorageAdmin = null;
  try {
    localStorageAdmin = localStorage.getItem("isAdmin");
  } catch (e) {
    console.warn("localStorage not available:", e);
  }
  try {
    sessionStorageAdmin = sessionStorage.getItem("isAdmin");
  } catch (e) {
    console.warn("sessionStorage not available:", e);
  }
  
  const isAdminUser =
    localStorageAdmin === "true" || sessionStorageAdmin === "true";
  
  if (isAdminUser) {
    els.manageBtn.style.display = "inline-block";
    els.manageBtn.style.visibility = "visible";
    els.manageBtn.style.opacity = "1";
    if (els.manageReviewsBtn) {
      els.manageReviewsBtn.style.display = "inline-flex";
    }
    if (els.viewReservationsBtn) {
      els.viewReservationsBtn.style.display = "inline-block";
    }
  } else {
    els.manageBtn.style.display = "none";
    if (els.manageReviewsBtn) {
      els.manageReviewsBtn.style.display = "none";
    }
    if (els.viewReservationsBtn) {
      els.viewReservationsBtn.style.display = "none";
    }
  }
  
  // Re-render menu to show/hide Edit buttons based on admin status
  renderMenu();
}

// Reviews functionality - RELIABLE VERSION: localStorage is source of truth
async function loadReviews() {
  // ALWAYS use localStorage as primary source - most reliable
  const saved = localStorage.getItem(STORAGE_KEYS.REVIEWS);
  let local = [];
  if (saved) {
    try {
      local = JSON.parse(saved) || [];
      // Ensure it's an array
      if (!Array.isArray(local)) {
        local = [];
      }
    } catch (e) {
      console.warn("Failed to parse reviews from localStorage:", e);
      local = [];
    }
  }

  // Background sync: Use backend as source of truth for deletions
  // Debounced to prevent flickering from rapid syncs
  if (window.reviewSyncTimeout) {
    clearTimeout(window.reviewSyncTimeout);
  }
  
  window.reviewSyncTimeout = setTimeout(() => {
    window.reviewSyncTimeout = null;
    state.isSyncingReviews = true; // Set flag to prevent rendering during sync
    apiGet("/reviews", () => null).then((backendReviews) => {
      if (Array.isArray(backendReviews)) {
        // Ensure backend reviews have itemName - if missing, try to get from menu
        backendReviews = backendReviews.map(review => {
          if (!review.itemName && review.itemId) {
            const menuItem = state.menu.find(item => item.id === review.itemId);
            review.itemName = menuItem?.name || review.item_name || "Unknown Item";
          } else if (!review.itemName) {
            review.itemName = review.item_name || "Unknown Item";
          }
          return review;
        });
        
        // Backend is source of truth - use it to sync deletions
        // Create a map of backend review IDs for quick lookup
        const backendIds = new Set(backendReviews.map(r => r.id));
        const backendMap = new Map(backendReviews.map(r => [r.id, r]));
        
        // Create a map of local reviews by ID for quick lookup
        const localMap = new Map(local.map(r => [r.id, r]));
        
        // Start with backend reviews (authoritative - these take priority)
        const merged = [...backendReviews];
        
        // Create a Set to track all IDs we've added (prevent duplicates)
        const mergedIds = new Set(merged.map(r => r.id));
        
        // Add any local reviews that don't exist in backend (pending sync)
        // Only add very recent local reviews that haven't been synced yet
        local.forEach(localReview => {
          // Skip if already in merged (prevents duplicates)
          if (mergedIds.has(localReview.id)) {
            return;
          }
          
          // If review doesn't exist in backend, check if it's recent (pending sync)
          if (!backendIds.has(localReview.id)) {
            const isRecent = localReview.timestamp && (Date.now() - localReview.timestamp < 10000);
            if (isRecent) {
              merged.push(localReview);
              mergedIds.add(localReview.id);
            }
          }
        });
        
        // Final deduplication by ID (critical - prevents any duplicates)
        const uniqueReviews = [];
        const seenIds = new Set();
        merged.forEach(review => {
          if (review.id && !seenIds.has(review.id)) {
            seenIds.add(review.id);
            uniqueReviews.push(review);
          }
        });
        
        // Sort by timestamp
        uniqueReviews.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        // Check if data actually changed before updating (compare full data, not just IDs)
        const currentData = JSON.stringify(local.map(r => ({ id: r.id, timestamp: r.timestamp })).sort((a, b) => a.id.localeCompare(b.id)));
        const newData = JSON.stringify(uniqueReviews.map(r => ({ id: r.id, timestamp: r.timestamp })).sort((a, b) => a.id.localeCompare(b.id)));
        const dataChanged = currentData !== newData;
        
        if (dataChanged) {
          // Only update localStorage if data actually changed
          localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(uniqueReviews));
          
          // Only re-render if not already rendering and data actually changed (prevents flickering)
          // Add a small delay to prevent rapid re-renders
          if (!state.isRenderingReviews) {
            setTimeout(() => {
              state.isSyncingReviews = false; // Clear sync flag
              if (!state.isRenderingReviews) {
                // Use requestAnimationFrame to batch DOM updates
                requestAnimationFrame(() => {
                  if (!state.isRenderingReviews) {
                    renderReviews();
                    // Don't call renderMenu() here - it will be called when needed
                    // This prevents duplicate rating displays
                  }
                });
              }
            }, 300);
          } else {
            state.isSyncingReviews = false; // Clear sync flag even if not rendering
          }
        } else {
          state.isSyncingReviews = false; // Clear sync flag if data didn't change
        }
      }
    }).catch(err => {
      // If backend fails, keep using local data
      console.warn("Background review sync failed (using local data):", err);
      state.isSyncingReviews = false; // Clear sync flag on error
    });
  }, 500); // 500ms debounce to prevent rapid syncs

  return local;
}

async function saveReviews(reviews) {
  // CRITICAL: Save to localStorage FIRST - this is our source of truth
  // Ensure reviews is a valid array
  if (!Array.isArray(reviews)) {
    console.error("saveReviews: reviews is not an array", reviews);
    return;
  }
  
  // Save immediately to localStorage - this is the reliable storage
  try {
    localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(reviews));
    console.log("Reviews saved to localStorage:", reviews.length, "reviews");
  } catch (e) {
    console.error("Failed to save reviews to localStorage:", e);
    // This is critical - if localStorage fails, we have a problem
    alert("Warning: Could not save review. Please try again.");
    return;
  }
  
    // Sync to backend - ensure it completes for proper multi-device sync
  const last = reviews[reviews.length - 1];
  if (last) {
    apiPost("/reviews", last, () => {
      console.warn("Backend sync failed, but review is saved locally");
      return null;
    }).then(() => {
      console.log("Review synced to backend successfully");
      // After successful sync, refresh from backend to get any updates
      // Clear cache to force re-render
      // Use a longer delay to prevent immediate duplicate rendering
      state.lastRenderedReviews = null;
      setTimeout(() => {
        loadReviews();
      }, 800);
    }).catch(err => {
      console.warn("Background backend sync failed (review is still saved locally):", err);
    });
  }
}

async function renderReviews() {
  // Prevent concurrent renders to avoid flickering
  if (state.isRenderingReviews) {
    return;
  }
  
  // Don't render if we're currently syncing (prevents duplicate rendering)
  if (state.isSyncingReviews) {
    return;
  }
  
  state.isRenderingReviews = true;
  
  try {
    // Load reviews synchronously from localStorage (reliable source)
    const saved = localStorage.getItem(STORAGE_KEYS.REVIEWS);
    let reviews = [];
    if (saved) {
      try {
        reviews = JSON.parse(saved) || [];
        if (!Array.isArray(reviews)) {
          reviews = [];
        }
      } catch (e) {
        console.error("Failed to parse reviews for rendering:", e);
        reviews = [];
      }
    }
    
    // Deduplicate by ID before rendering (prevent duplicates)
    const seenIds = new Set();
    const uniqueReviews = [];
    reviews.forEach(review => {
      if (review.id && !seenIds.has(review.id)) {
        seenIds.add(review.id);
        uniqueReviews.push(review);
      }
    });
    reviews = uniqueReviews;
    
    // Sort reviews by timestamp
    reviews.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    // Check if data actually changed to prevent unnecessary re-renders
    const reviewsKey = JSON.stringify(reviews.map(r => ({ id: r.id, timestamp: r.timestamp })));
    if (state.lastRenderedReviews === reviewsKey) {
      // Data hasn't changed, skip render
      state.isRenderingReviews = false;
      return;
    }
    
    // Update cache
    state.lastRenderedReviews = reviewsKey;
    
    if (!reviews.length) {
      els.reviewsEmptyState.classList.remove("hidden");
      els.reviewsList.innerHTML = "";
      renderManageReviewsList();
      state.isRenderingReviews = false;
      return;
    }

    els.reviewsEmptyState.classList.add("hidden");
    
    // Build HTML
    const reviewsHtml = reviews
      .map((review) => {
        const stars = getRatingStars(review.rating);
        const date = review.timestamp 
          ? new Date(review.timestamp).toLocaleDateString("en-IN", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "Recently";
        return `
          <article class="review-card">
            <div class="review-header">
              <div class="reviewer-info">
                <div class="reviewer-name">${escapeHtml(review.reviewerName || "Anonymous")}</div>
                <div class="review-item-name">${escapeHtml(review.itemName || "Unknown Item")}</div>
                <div class="review-rating-display">
                  <div class="stars">${stars}</div>
                  <span>${review.rating || 0}/5</span>
                </div>
              </div>
            </div>
            <div class="review-text">${escapeHtml(review.text || "")}</div>
            <div class="review-date">${date}</div>
          </article>
        `;
      })
      .join("");

    // Update DOM in one operation to prevent flickering
    els.reviewsList.innerHTML = reviewsHtml;

    renderManageReviewsList();
  } catch (err) {
    console.error("Error rendering reviews:", err);
  } finally {
    state.isRenderingReviews = false;
  }
}

function openReviewModal() {
  if (!els.reviewModal || !els.reviewForm || !els.reviewItemId) {
    console.error("Review modal elements not found");
    return;
  }
  
  // Populate item dropdown
  els.reviewItemId.innerHTML = '<option value="">Choose an item...</option>';
  state.menu.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    els.reviewItemId.appendChild(option);
  });
  
  // Reset form
  els.reviewForm.reset();
  els.reviewRating.value = "0";
  highlightStars(0);
  els.reviewModal.classList.remove("hidden");
  
  // Setup star rating after modal is visible
  setTimeout(() => {
    setupStarRating();
  }, 100);
}

function closeReviewModal() {
  els.reviewModal.classList.add("hidden");
}

function setStarRating(rating) {
  els.reviewRating.value = rating;
  highlightStars(rating);
}

function highlightStars(rating) {
  els.starRating.querySelectorAll(".star").forEach((star, index) => {
    if (index < rating) {
      star.classList.add("active", "filled");
    } else {
      star.classList.remove("active", "filled");
    }
  });
}

function getRatingStars(rating) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  let starsHtml = "";
  
  for (let i = 0; i < fullStars; i++) {
    starsHtml += '<span>⭐</span>';
  }
  if (hasHalfStar && fullStars < 5) {
    starsHtml += '<span>⭐</span>'; // Using full star for simplicity
  }
  for (let i = fullStars + (hasHalfStar ? 1 : 0); i < 5; i++) {
    starsHtml += '<span style="filter: grayscale(100%) opacity(0.3);">⭐</span>';
  }
  
  return starsHtml;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function openManageReviewsModal() {
  if (!els.manageReviewsModal) return;
  els.manageReviewsModal.classList.remove("hidden");
}

function closeManageReviewsModal() {
  if (!els.manageReviewsModal) return;
  els.manageReviewsModal.classList.add("hidden");
}

async function renderManageReviewsList() {
  if (!els.manageReviewsList) return;
  
  // Load from localStorage directly (reliable source)
  const saved = localStorage.getItem(STORAGE_KEYS.REVIEWS);
  let reviews = [];
  if (saved) {
    try {
      reviews = JSON.parse(saved) || [];
      if (!Array.isArray(reviews)) {
        reviews = [];
      }
    } catch (e) {
      console.error("Failed to parse reviews for manage list:", e);
      reviews = [];
    }
  }

  if (!reviews.length) {
    els.manageReviewsList.innerHTML =
      '<p class="empty-state">No reviews to manage.</p>';
    return;
  }

  els.manageReviewsList.innerHTML = reviews
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .map((review) => {
      const date = review.timestamp 
        ? new Date(review.timestamp).toLocaleString()
        : "Recently";
      return `
        <article class="manage-review-item">
          <header>
            <div>
              <strong>${escapeHtml(review.reviewerName || "Anonymous")}</strong>
              <div>${escapeHtml(review.itemName || "Unknown Item")}</div>
            </div>
            <span>${review.rating || 0}/5</span>
          </header>
          <p>${escapeHtml(review.text || "")}</p>
          <small>${date}</small>
          <button class="btn ghost" data-action="delete-review" data-id="${review.id}">
            Remove Review
          </button>
        </article>
      `;
    })
    .join("");

  els.manageReviewsList
    .querySelectorAll('[data-action="delete-review"]')
    .forEach((btn) =>
      btn.addEventListener("click", () => {
        deleteReview(btn.dataset.id);
      })
    );
}

async function deleteReview(id) {
  if (!id) return;
  
  // Load from localStorage (reliable source)
  const saved = localStorage.getItem(STORAGE_KEYS.REVIEWS);
  let reviews = [];
  if (saved) {
    try {
      reviews = JSON.parse(saved) || [];
      if (!Array.isArray(reviews)) {
        reviews = [];
      }
    } catch (e) {
      console.error("Failed to parse reviews for deletion:", e);
      reviews = [];
    }
  }
  
  // Remove the review
  reviews = reviews.filter((review) => review.id !== id);
  
  // Save immediately to localStorage (reliable storage)
  try {
    localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(reviews));
    console.log("Review deleted from localStorage");
  } catch (e) {
    console.error("Failed to delete review from localStorage:", e);
    alert("Error: Could not delete review. Please try again.");
    return;
  }
  
    // Sync deletion to backend - wait for it to complete to ensure sync
  apiDelete(`/reviews?id=${encodeURIComponent(id)}`, () => {
    console.warn("Backend deletion sync failed, but review is deleted locally");
    return null;
  }).then(() => {
    console.log("Review deletion synced to backend successfully");
    // After successful deletion, trigger a sync to update from backend
    // Clear cache to force re-render
    state.lastRenderedReviews = null;
    setTimeout(() => {
      loadReviews();
    }, 300);
  }).catch(err => {
    console.warn("Background backend deletion sync failed (review is still deleted locally):", err);
  });
  
  // Clear cache and update UI immediately
  state.lastRenderedReviews = null;
  renderReviews();
  renderManageReviewsList();
}

// Search and filter functionality
if (els.menuSearch) {
  els.menuSearch.addEventListener("input", (e) => {
    filterMenu(e.target.value, els.menuCategoryFilter?.value || "");
  });
}

// Track category filter to prevent accidental resets
let categoryFilterLocked = false;

if (els.menuCategoryFilter) {
  els.menuCategoryFilter.addEventListener("change", (e) => {
    const selectedCategory = e.target.value;
    filterMenu(els.menuSearch?.value || "", selectedCategory);
    // Lock the filter to prevent it from being reset
    categoryFilterLocked = true;
    // Unlock after a short delay to allow normal updates
    setTimeout(() => {
      categoryFilterLocked = false;
    }, 2000);
  });
}

function filterMenu(searchTerm, category) {
  const allCards = els.menuList.querySelectorAll(".menu-card");
  const searchLower = searchTerm.toLowerCase();
  
  allCards.forEach((card) => {
    const name = card.querySelector("h3")?.textContent.toLowerCase() || "";
    const categoryText = card.querySelector("p")?.textContent.toLowerCase() || "";
    const matchesSearch = !searchTerm || name.includes(searchLower);
    const matchesCategory = !category || categoryText.includes(category.toLowerCase());
    
    if (matchesSearch && matchesCategory) {
      card.style.display = "";
    } else {
      card.style.display = "none";
    }
  });
}


// Order History
if (els.orderHistoryBtn) {
  els.orderHistoryBtn.addEventListener("click", openOrderHistoryModal);
}

if (els.closeOrderHistoryModalBtn) {
  els.closeOrderHistoryModalBtn.addEventListener("click", closeOrderHistoryModal);
}

if (els.orderHistoryModal) {
  els.orderHistoryModal.addEventListener("click", (evt) => {
    if (evt.target === els.orderHistoryModal) {
      closeOrderHistoryModal();
    }
  });
}

async function openOrderHistoryModal() {
  if (!els.orderHistoryModal) return;
  
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.email) {
    alert("Please log in to view order history.");
    return;
  }
  
  try {
    const orders = await apiGet(`/orders?userEmail=${encodeURIComponent(currentUser.email)}`, () => []);
    renderOrderHistory(orders);
    els.orderHistoryModal.classList.remove("hidden");
  } catch (err) {
    console.error("Error loading order history:", err);
    alert("Failed to load order history. Please try again.");
  }
}

function closeOrderHistoryModal() {
  if (els.orderHistoryModal) {
    els.orderHistoryModal.classList.add("hidden");
  }
}

function renderOrderHistory(orders) {
  if (!els.orderHistoryList) return;
  
  if (!orders || orders.length === 0) {
    els.orderHistoryList.innerHTML = '<p class="empty-state">No orders yet. Start ordering to see your history here!</p>';
    return;
  }
  
  els.orderHistoryList.innerHTML = orders.map(order => {
    const date = new Date(order.createdAt || order.created_at * 1000 || Date.now()).toLocaleString();
    const items = Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? JSON.parse(order.items) : []);
    const total = order.total || 0;
    
    return `
      <article class="order-history-item">
        <header>
          <div>
            <h4>Order #${order.id ? order.id.slice(-8) : 'N/A'}</h4>
            <p class="order-date">${date}</p>
          </div>
          <div class="order-header-right">
            <strong class="order-total">${formatCurrency(total)}</strong>
            <span class="order-status status-${order.status || 'ordered'}">${(order.status || 'ordered').toUpperCase()}</span>
          </div>
        </header>
        <div class="order-items">
          ${items.map(item => `
            <div class="order-item">
              <span class="item-name">${escapeHtml(item.name || 'Unknown')}</span>
              <span class="item-details">${item.qty || 1}x ${formatCurrency(item.price || 0)}</span>
            </div>
          `).join("")}
        </div>
        ${order.subtotal ? `<div class="order-summary">
          <div>Subtotal: ${formatCurrency(order.subtotal)}</div>
          ${order.tax ? `<div>Tax: ${formatCurrency(order.tax)}</div>` : ''}
          <div class="order-total-line">Total: ${formatCurrency(total)}</div>
        </div>` : ''}
      </article>
    `;
  }).join("");
}


// Update checkAdminStatus (analytics removed)
const originalCheckAdminStatus = checkAdminStatus;
checkAdminStatus = function() {
  originalCheckAdminStatus();
};

// Make checkAdminStatus available globally for testing
window.checkAdminStatus = checkAdminStatus;

// Debug function to check all admin sources
window.debugAdmin = function() {
  console.log("=== DEBUG ADMIN STATUS ===");
  console.log("Current URL:", window.location.href);
  console.log("URL search:", window.location.search);
  
  try {
    const urlParams = new URLSearchParams(window.location.search);
    console.log("URL param admin:", urlParams.get("admin"));
  } catch (e) {
    console.log("URL param error:", e);
  }
  
  try {
    console.log("localStorage isAdmin:", localStorage.getItem("isAdmin"));
  } catch (e) {
    console.log("localStorage error:", e);
  }
  
  try {
    console.log("sessionStorage isAdmin:", sessionStorage.getItem("isAdmin"));
  } catch (e) {
    console.log("sessionStorage error:", e);
  }
  
  console.log("Button element:", els.manageBtn);
  console.log("Button display:", els.manageBtn ? window.getComputedStyle(els.manageBtn).display : "not found");
  
  // Force set admin if needed
  console.log("\n💡 To force admin mode, run:");
  console.log("localStorage.setItem('isAdmin', 'true'); sessionStorage.setItem('isAdmin', 'true'); checkAdminStatus();");
};

