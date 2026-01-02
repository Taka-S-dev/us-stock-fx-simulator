export function initRangeSliders() {
  const fxSlider = document.getElementById("fx-slider");
  const priceSlider = document.getElementById("price-slider");

  const fxMinInput = document.getElementById("fx-min-input");
  const fxMaxInput = document.getElementById("fx-max-input");
  const priceMinInput = document.getElementById("price-min-input");
  const priceMaxInput = document.getElementById("price-max-input");
  const priceMaxToggle = document.getElementById("price-max-toggle");

  const fxMargin = 7;
  const priceMargin = 70;
  const DEFAULT_PRICE_MAX = 1000;
  const EXTENDED_PRICE_MAX = 5000;

  // デバウンス用のタイマー
  let updateTimeout = null;
  let isUpdating = false;

  // デバウンス付きグラフ更新関数
  const debouncedUpdateGraph = () => {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    updateTimeout = setTimeout(() => {
      if (!isUpdating) {
        document.dispatchEvent(new CustomEvent("inputChanged"));
      }
    }, 30);
  };

  noUiSlider.create(fxSlider, {
    start: [120, 160],
    connect: true,
    range: { min: 100, max: 200 },
    margin: fxMargin,
    step: 1,
    tooltips: false,
    format: {
      to: (val) => parseFloat(val).toFixed(1),
      from: (val) => parseFloat(val),
    },
  });

  // 初期は max=1000
  noUiSlider.create(priceSlider, {
    start: [100, 300],
    connect: true,
    range: { min: 1, max: DEFAULT_PRICE_MAX },
    margin: priceMargin,
    step: 1,
    tooltips: false,
    format: {
      to: (val) => parseFloat(val).toFixed(1),
      from: (val) => parseFloat(val),
    },
  });

  // イッチで最大値を 1000 ⇄ 5000 に固定切り替え
  if (priceMaxToggle) {
    priceMaxToggle.addEventListener("change", () => {
      try {
        isUpdating = true;
        const [currentMin, currentMax] = priceSlider.noUiSlider
          .get()
          .map(parseFloat);
        const newMax = priceMaxToggle.checked
          ? EXTENDED_PRICE_MAX
          : DEFAULT_PRICE_MAX;

        priceSlider.noUiSlider.updateOptions({
          range: { min: 1, max: newMax },
        });

        // 新しい最大値に基づいて値を調整
        let min = Math.max(1, currentMin);
        let max = Math.min(currentMax, newMax);

        // 現在の最大値が新しい最大値を超えている場合は調整
        if (currentMax > newMax) {
          max = newMax;
          // 最小値は現在の値を保持し、必要に応じて調整
          min = Math.max(1, Math.min(currentMin, max - priceMargin));
        }

        // 最小値と最大値の間隔を確保（最小値は可能な限り保持）
        if (max - min < priceMargin) {
          if (newMax === EXTENDED_PRICE_MAX) {
            // 5000に切り替える場合は、より広い範囲を設定
            min = Math.max(1, max - priceMargin);
          } else {
            // 1000に戻す場合は、現在の最小値を優先しつつ調整
            const preferredMin = Math.max(1, currentMin);
            if (preferredMin + priceMargin <= newMax) {
              min = preferredMin;
              max = preferredMin + priceMargin;
            } else {
              min = Math.max(1, newMax - priceMargin);
              max = newMax;
            }
          }
        }

        priceSlider.noUiSlider.set([min, max]);

        // 入力フィールドも同期
        const priceMinInput = document.getElementById("price-min-input");
        const priceMaxInput = document.getElementById("price-max-input");
        if (priceMinInput) priceMinInput.value = min.toFixed(1);
        if (priceMaxInput) priceMaxInput.value = max.toFixed(1);

        // グラフ更新を遅延実行
        setTimeout(() => {
          isUpdating = false;
          debouncedUpdateGraph();
        }, 50);
      } catch (error) {
        console.error("トグル切り替えエラー:", error);
        isUpdating = false;
      }
    });
  }

  fxMinInput.addEventListener("change", () => {
    try {
      isUpdating = true;
      let min = parseFloat(fxMinInput.value);
      let max = parseFloat(fxMaxInput.value);
      if (max - min < fxMargin) {
        min = max - fxMargin;
        fxMinInput.value = min.toFixed(1);
      }
      fxSlider.noUiSlider.set([min, max]);
      setTimeout(() => {
        isUpdating = false;
        debouncedUpdateGraph();
      }, 50);
    } catch (error) {
      console.error("為替最小値変更エラー:", error);
      isUpdating = false;
    }
  });

  fxMaxInput.addEventListener("change", () => {
    try {
      isUpdating = true;
      let min = parseFloat(fxMinInput.value);
      let max = parseFloat(fxMaxInput.value);
      if (max - min < fxMargin) {
        max = min + fxMargin;
        fxMaxInput.value = max.toFixed(1);
      }
      fxSlider.noUiSlider.set([min, max]);
      setTimeout(() => {
        isUpdating = false;
        debouncedUpdateGraph();
      }, 50);
    } catch (error) {
      console.error("為替最大値変更エラー:", error);
      isUpdating = false;
    }
  });

  priceMinInput.addEventListener("change", () => {
    try {
      isUpdating = true;
      let min = parseFloat(priceMinInput.value);
      let max = parseFloat(priceMaxInput.value);
      if (max - min < priceMargin) {
        min = max - priceMargin;
        priceMinInput.value = min.toFixed(1);
      }
      priceSlider.noUiSlider.set([min, max]);
      setTimeout(() => {
        isUpdating = false;
        debouncedUpdateGraph();
      }, 50);
    } catch (error) {
      console.error("株価最小値変更エラー:", error);
      isUpdating = false;
    }
  });

  priceMaxInput.addEventListener("change", () => {
    try {
      isUpdating = true;
      let min = parseFloat(priceMinInput.value);
      let max = parseFloat(priceMaxInput.value);
      if (max - min < priceMargin) {
        max = min + priceMargin;
        priceMaxInput.value = max.toFixed(1);
      }
      priceSlider.noUiSlider.set([min, max]);
      setTimeout(() => {
        isUpdating = false;
        debouncedUpdateGraph();
      }, 50);
    } catch (error) {
      console.error("株価最大値変更エラー:", error);
      isUpdating = false;
    }
  });

  fxSlider.noUiSlider.on("update", ([min, max]) => {
    try {
      fxMinInput.value = min;
      fxMaxInput.value = max;

      // デバウンス付きでグラフ更新
      debouncedUpdateGraph();
    } catch (error) {
      console.error("為替スライダー更新エラー:", error);
    }
  });

  priceSlider.noUiSlider.on("update", ([min, max]) => {
    try {
      priceMinInput.value = min;
      priceMaxInput.value = max;

      // デバウンス付きでグラフ更新
      debouncedUpdateGraph();
    } catch (error) {
      console.error("株価スライダー更新エラー:", error);
    }
  });

  document.querySelectorAll(".noUi-handle").forEach((h) => {
    h.setAttribute("tabindex", "0");
  });
}

// モーダル内のスライダーを初期化する関数（高速版）
export function initModalRangeSliders() {
  const fxSliderModal = document.getElementById("fx-slider-modal");
  const priceSliderModal = document.getElementById("price-slider-modal");

  const fxMinInputModal = document.getElementById("fx-min-input-modal");
  const fxMaxInputModal = document.getElementById("fx-max-input-modal");
  const priceMinInputModal = document.getElementById("price-min-input-modal");
  const priceMaxInputModal = document.getElementById("price-max-input-modal");
  const priceMaxToggleModal = document.getElementById("price-max-toggle-modal");

  if (!fxSliderModal || !priceSliderModal) return;

  const fxMargin = 7;
  const priceMargin = 70;
  const DEFAULT_PRICE_MAX = 1000;
  const EXTENDED_PRICE_MAX = 5000;

  // デバウンス用のタイマー（モーダル用）
  let modalUpdateTimeout = null;
  let isModalUpdating = false;

  // デバウンス付きグラフ更新関数（モーダル用）
  const debouncedModalUpdateGraph = () => {
    if (modalUpdateTimeout) {
      clearTimeout(modalUpdateTimeout);
    }
    modalUpdateTimeout = setTimeout(() => {
      if (!isModalUpdating) {
        document.dispatchEvent(new CustomEvent("inputChanged"));
      }
    }, 30);
  };

  // 現在の値を取得
  const currentFxMin = fxMinInputModal
    ? parseFloat(fxMinInputModal.value)
    : 120;
  const currentFxMax = fxMaxInputModal
    ? parseFloat(fxMaxInputModal.value)
    : 160;
  const currentPriceMin = priceMinInputModal
    ? parseFloat(priceMinInputModal.value)
    : 100;
  const currentPriceMax = priceMaxInputModal
    ? parseFloat(priceMaxInputModal.value)
    : 300;

  // 既存のスライダーを破棄（高速化）
  if (fxSliderModal.noUiSlider) {
    fxSliderModal.noUiSlider.destroy();
  }
  if (priceSliderModal.noUiSlider) {
    priceSliderModal.noUiSlider.destroy();
  }

  // スライダー作成を非同期で実行
  setTimeout(() => {
    // 為替スライダーを作成（現在の値で初期化）
    noUiSlider.create(fxSliderModal, {
      start: [currentFxMin, currentFxMax],
      connect: true,
      range: { min: 100, max: 200 },
      margin: fxMargin,
      step: 1,
      tooltips: false,
      format: {
        to: (val) => parseFloat(val).toFixed(1),
        from: (val) => parseFloat(val),
      },
    });

    // 株価スライダーを作成（現在の値で初期化）
    // メインのトグル状態を確認して適切な最大値を設定
    const mainPriceMaxToggle = document.getElementById("price-max-toggle");
    const initialPriceMax =
      mainPriceMaxToggle && mainPriceMaxToggle.checked
        ? EXTENDED_PRICE_MAX
        : DEFAULT_PRICE_MAX;

    noUiSlider.create(priceSliderModal, {
      start: [currentPriceMin, currentPriceMax],
      connect: true,
      range: { min: 1, max: initialPriceMax },
      margin: priceMargin,
      step: 1,
      tooltips: false,
      format: {
        to: (val) => parseFloat(val).toFixed(1),
        from: (val) => parseFloat(val),
      },
    });

    // モーダル内のトグルもメインの状態に同期
    if (priceMaxToggleModal && mainPriceMaxToggle) {
      priceMaxToggleModal.checked = mainPriceMaxToggle.checked;
    }

    // スイッチで最大値を切り替え
    if (priceMaxToggleModal) {
      priceMaxToggleModal.addEventListener("change", () => {
        try {
          isModalUpdating = true;
          const [currentMin, currentMax] = priceSliderModal.noUiSlider
            .get()
            .map(parseFloat);
          const newMax = priceMaxToggleModal.checked
            ? EXTENDED_PRICE_MAX
            : DEFAULT_PRICE_MAX;

          priceSliderModal.noUiSlider.updateOptions({
            range: { min: 1, max: newMax },
          });

          // 新しい最大値に基づいて値を調整
          let min = Math.max(1, currentMin);
          let max = Math.min(currentMax, newMax);

          // 現在の最大値が新しい最大値を超えている場合は調整
          if (currentMax > newMax) {
            max = newMax;
            // 最小値は現在の値を保持し、必要に応じて調整
            min = Math.max(1, Math.min(currentMin, max - priceMargin));
          }

          // 最小値と最大値の間隔を確保（最小値は可能な限り保持）
          if (max - min < priceMargin) {
            if (newMax === EXTENDED_PRICE_MAX) {
              // 5000に切り替える場合は、より広い範囲を設定
              min = Math.max(1, max - priceMargin);
            } else {
              // 1000に戻す場合は、現在の最小値を優先しつつ調整
              const preferredMin = Math.max(1, currentMin);
              if (preferredMin + priceMargin <= newMax) {
                min = preferredMin;
                max = preferredMin + priceMargin;
              } else {
                min = Math.max(1, newMax - priceMargin);
                max = newMax;
              }
            }
          }

          priceSliderModal.noUiSlider.set([min, max]);

          // 入力フィールドも同期
          if (priceMinInputModal) priceMinInputModal.value = min.toFixed(1);
          if (priceMaxInputModal) priceMaxInputModal.value = max.toFixed(1);

          // メインのスライダーも同期
          const mainPriceSlider =
            document.getElementById("price-slider")?.noUiSlider;
          if (mainPriceSlider) {
            // メインのスライダーの最大値も更新
            mainPriceSlider.updateOptions({
              range: { min: 1, max: newMax },
            });
            mainPriceSlider.set([min, max]);
          }

          // メインのトグル状態も同期
          const mainPriceMaxToggle =
            document.getElementById("price-max-toggle");
          if (mainPriceMaxToggle) {
            mainPriceMaxToggle.checked = priceMaxToggleModal.checked;
          }

          // グラフ更新を遅延実行
          setTimeout(() => {
            isModalUpdating = false;
            debouncedModalUpdateGraph();
          }, 50);
        } catch (error) {
          console.error("モーダルトグル切り替えエラー:", error);
          isModalUpdating = false;
        }
      });
    }

    // 入力フィールドのイベント
    fxMinInputModal?.addEventListener("change", () => {
      try {
        isModalUpdating = true;
        let min = parseFloat(fxMinInputModal.value);
        let max = parseFloat(fxMaxInputModal.value);
        if (max - min < fxMargin) {
          min = max - fxMargin;
          fxMinInputModal.value = min.toFixed(1);
        }
        fxSliderModal.noUiSlider.set([min, max]);

        // メインのスライダーも同期
        const mainFxSlider = document.getElementById("fx-slider")?.noUiSlider;
        if (mainFxSlider) {
          mainFxSlider.set([min, max]);
        }

        setTimeout(() => {
          isModalUpdating = false;
          debouncedModalUpdateGraph();
        }, 50);
      } catch (error) {
        console.error("モーダル為替最小値変更エラー:", error);
        isModalUpdating = false;
      }
    });

    fxMaxInputModal?.addEventListener("change", () => {
      try {
        isModalUpdating = true;
        let min = parseFloat(fxMinInputModal.value);
        let max = parseFloat(fxMaxInputModal.value);
        if (max - min < fxMargin) {
          max = min + fxMargin;
          fxMaxInputModal.value = max.toFixed(1);
        }
        fxSliderModal.noUiSlider.set([min, max]);

        // メインのスライダーも同期
        const mainFxSlider = document.getElementById("fx-slider")?.noUiSlider;
        if (mainFxSlider) {
          mainFxSlider.set([min, max]);
        }

        setTimeout(() => {
          isModalUpdating = false;
          debouncedModalUpdateGraph();
        }, 50);
      } catch (error) {
        console.error("モーダル為替最大値変更エラー:", error);
        isModalUpdating = false;
      }
    });

    priceMinInputModal?.addEventListener("change", () => {
      try {
        isModalUpdating = true;
        let min = parseFloat(priceMinInputModal.value);
        let max = parseFloat(priceMaxInputModal.value);
        if (max - min < priceMargin) {
          min = max - priceMargin;
          priceMinInputModal.value = min.toFixed(1);
        }
        priceSliderModal.noUiSlider.set([min, max]);

        // メインのスライダーも同期
        const mainPriceSlider =
          document.getElementById("price-slider")?.noUiSlider;
        if (mainPriceSlider) {
          mainPriceSlider.set([min, max]);
        }

        setTimeout(() => {
          isModalUpdating = false;
          debouncedModalUpdateGraph();
        }, 50);
      } catch (error) {
        console.error("モーダル株価最小値変更エラー:", error);
        isModalUpdating = false;
      }
    });

    priceMaxInputModal?.addEventListener("change", () => {
      try {
        isModalUpdating = true;
        let min = parseFloat(priceMinInputModal.value);
        let max = parseFloat(priceMaxInputModal.value);
        if (max - min < priceMargin) {
          max = min + priceMargin;
          priceMaxInputModal.value = max.toFixed(1);
        }
        priceSliderModal.noUiSlider.set([min, max]);

        // メインのスライダーも同期
        const mainPriceSlider =
          document.getElementById("price-slider")?.noUiSlider;
        if (mainPriceSlider) {
          mainPriceSlider.set([min, max]);
        }

        setTimeout(() => {
          isModalUpdating = false;
          debouncedModalUpdateGraph();
        }, 50);
      } catch (error) {
        console.error("モーダル株価最大値変更エラー:", error);
        isModalUpdating = false;
      }
    });

    // スライダーの更新イベント
    fxSliderModal.noUiSlider.on("update", ([min, max]) => {
      try {
        fxMinInputModal.value = min;
        fxMaxInputModal.value = max;
        // メインの入力フィールドも同期
        const fxMinInput = document.getElementById("fx-min-input");
        const fxMaxInput = document.getElementById("fx-max-input");
        if (fxMinInput) fxMinInput.value = min;
        if (fxMaxInput) fxMaxInput.value = max;

        // メインのスライダーも同期
        const mainFxSlider = document.getElementById("fx-slider")?.noUiSlider;
        if (mainFxSlider) {
          mainFxSlider.set([min, max]);
        }

        // デバウンス付きでグラフ更新
        debouncedModalUpdateGraph();
      } catch (error) {
        console.error("モーダル為替スライダー更新エラー:", error);
      }
    });

    priceSliderModal.noUiSlider.on("update", ([min, max]) => {
      try {
        priceMinInputModal.value = min;
        priceMaxInputModal.value = max;
        // メインの入力フィールドも同期
        const priceMinInput = document.getElementById("price-min-input");
        const priceMaxInput = document.getElementById("price-max-input");
        if (priceMinInput) priceMinInput.value = min;
        if (priceMaxInput) priceMaxInput.value = max;

        // メインのスライダーも同期
        const mainPriceSlider =
          document.getElementById("price-slider")?.noUiSlider;
        if (mainPriceSlider) {
          mainPriceSlider.set([min, max]);
        }

        // デバウンス付きでグラフ更新
        debouncedModalUpdateGraph();
      } catch (error) {
        console.error("モーダル株価スライダー更新エラー:", error);
      }
    });

    // アクセシビリティ
    document.querySelectorAll(".noUi-handle").forEach((h) => {
      h.setAttribute("tabindex", "0");
    });
  }, 0);
}
