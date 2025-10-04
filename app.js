const { createApp } = Vue;

createApp({
    data() {
        return {
            allRestaurants: [],
            foodTypes: [],
            zoneTypes: [],
            foodTypeMap: {},
            zoneTypeMap: {},
            filters: {
                food: [],
                zone: null
            },
            searchQuery: '',
            isFilterBarCollapsed: false,
            hasUserToggledFilterBar: false,
            isLoading: true,
            imageModalVisible: false,
            selectedImageUrl: '',
            modalImages: [],
            modalImageIndex: 0,
            modalTouchStartX: null,
            menuModalVisible: false,
            selectedMenuRestaurant: null,
            errorMessage: ''
        };
    },
    computed: {
        filteredRestaurants() {
            if (this.errorMessage) {
                return [];
            }

            const keyword = this.searchQuery.trim().toLowerCase();

            return this.allRestaurants.filter(item => {
                const foodTypes = (item.foodTypeCds || '').split(',').map(id => id.trim()).filter(Boolean);
                const zoneMatch = !this.filters.zone || item.zoneType === this.filters.zone;
                const foodMatch = this.filters.food.length === 0 || foodTypes.some(id => this.filters.food.includes(id));
                const searchMatch = this.matchesSearch(item, keyword);

                return foodMatch && zoneMatch && searchMatch;
            });
        },
        menuModalTitle() {
            if (!this.selectedMenuRestaurant) {
                return '菜單';
            }
            return `${this.selectedMenuRestaurant.DetailShortInfo.faciltNameCN || 'N/A'} - 菜單`;
        },
        hasActiveFilters() {
            return this.filters.food.length > 0 || !!this.filters.zone || !!this.searchQuery;
        },
        filterBarToggleText() {
            return this.isFilterBarCollapsed ? '展開搜尋與篩選' : '收合搜尋與篩選';
        },
        filterBarSummary() {
            const summaryParts = [];

            if (this.searchQuery) {
                summaryParts.push(`搜尋：「${this.searchQuery}」`);
            }

            if (this.filters.food.length) {
                const names = this.filters.food
                    .map(id => this.getFoodTypeName(id))
                    .filter(Boolean);

                if (names.length) {
                    summaryParts.push(`食物類型：${names.join('、')}`);
                }
            }

            if (this.filters.zone) {
                const zoneName = this.getZoneTypeName(this.filters.zone);
                if (zoneName && zoneName !== '未知區域') {
                    summaryParts.push(`園區分區：${zoneName}`);
                }
            }

            if (!summaryParts.length) {
                return '尚未套用任何篩選條件';
            }

            return summaryParts.join(' ｜ ');
        },
        hasPrevModalImage() {
            return this.modalImages.length > 1 && this.modalImageIndex > 0;
        },
        hasNextModalImage() {
            return (
                this.modalImages.length > 1 &&
                this.modalImageIndex < this.modalImages.length - 1
            );
        }
    },
    methods: {
        async loadData() {
            try {
                const [mainInfo, foodTypesData, zoneTypesData] = await Promise.all([
                    fetch('./mainShortInfo.json').then(res => res.json()),
                    fetch('./faciltFoodType.json').then(res => res.json()),
                    fetch('./zoneKindCd.json').then(res => res.json())
                ]);

                this.allRestaurants = mainInfo;
                this.foodTypes = foodTypesData;
                this.zoneTypes = zoneTypesData;
                this.foodTypeMap = Object.fromEntries(foodTypesData.map(item => [item.codeId, item.codeNameCN]));
                this.zoneTypeMap = Object.fromEntries(zoneTypesData.map(item => [item.codeId, item.codeNameCN]));
            } catch (error) {
                console.error('Error fetching or processing data:', error);
                this.errorMessage = '無法載入資料，請確認所有 JSON 檔案都存在。';
            } finally {
                this.isLoading = false;
            }
        },
        matchesSearch(restaurant, keyword) {
            if (!keyword) {
                return true;
            }

            const { DetailShortInfo } = restaurant;
            const nameCn = (DetailShortInfo.faciltNameCN || '').toLowerCase();
            const nameEng = (DetailShortInfo.faciltNameEng || '').toLowerCase();
            const keywords = (DetailShortInfo.keywordDescrtCN || '').toLowerCase();

            const menuTexts = (DetailShortInfo.menuList || [])
                .map(item => `${item.menuDescrtCN || ''} ${item.menuDescrtEng || ''}`.toLowerCase())
                .join(' ');

            return [nameCn, nameEng, keywords, menuTexts].some(text => text.includes(keyword));
        },
        getFoodTypeIds(restaurant) {
            return (restaurant.foodTypeCds || '').split(',').map(id => id.trim()).filter(Boolean);
        },
        getBannerImages(restaurant) {
            if (!restaurant || !restaurant.DetailShortInfo) {
                return [];
            }

            const banners = restaurant.DetailShortInfo.bannerImgUrl || [];

            return banners
                .map(item => {
                    if (typeof item === 'string') {
                        return item;
                    }
                    if (item && typeof item.bannerImgUrl === 'string') {
                        return item.bannerImgUrl;
                    }
                    return null;
                })
                .filter(url => typeof url === 'string' && url.trim().length > 0);
        },
        getGalleryAriaLabel(restaurant) {
            const count = this.getBannerImages(restaurant).length;

            if (count > 1) {
                return `餐廳照片，共 ${count} 張，可左右滑動瀏覽`;
            }

            if (count === 1) {
                return '餐廳照片，共 1 張';
            }

            return '餐廳照片';
        },
        getFoodTypeName(id) {
            return this.foodTypeMap[id] || '未知';
        },
        getZoneTypeName(id) {
            return this.zoneTypeMap[id] || '未知區域';
        },
        formatKeywords(keywords) {
            return keywords ? keywords.replace(/#/g, ', ') : '';
        },
        toggleFoodFilter(foodId) {
            if (this.filters.food.includes(foodId)) {
                this.filters.food = this.filters.food.filter(id => id !== foodId);
            } else {
                this.filters.food = [...this.filters.food, foodId];
            }
        },
        toggleZoneFilter(zoneId) {
            if (this.filters.zone === zoneId) {
                this.filters.zone = null;
            } else {
                this.filters.zone = zoneId;
            }
        },
        isFoodFilterActive(foodId) {
            return this.filters.food.includes(foodId);
        },
        isZoneFilterActive(zoneId) {
            return this.filters.zone === zoneId;
        },
        setFoodFilter(foodId) {
            this.filters.food = [foodId];
        },
        setZoneFilter(zoneId) {
            this.filters.zone = zoneId;
        },
        clearFilters() {
            this.filters.food = [];
            this.filters.zone = null;
            this.searchQuery = '';
        },
        toggleFilterBar() {
            this.isFilterBarCollapsed = !this.isFilterBarCollapsed;
            this.hasUserToggledFilterBar = true;
        },
        handleResize() {
            if (typeof window === 'undefined') {
                return;
            }

            if (window.innerWidth > 768) {
                this.isFilterBarCollapsed = false;
                this.hasUserToggledFilterBar = false;
                return;
            }

            if (!this.hasUserToggledFilterBar) {
                this.isFilterBarCollapsed = true;
            }
        },
        buildGoogleMapUrl(restaurant) {
            const loc = restaurant.DetailShortInfo.locList && restaurant.DetailShortInfo.locList[0];
            if (!loc || !loc.latud || !loc.lgtud) {
                return '#';
            }
            return `https://www.google.com/maps?q=${loc.latud},${loc.lgtud}`;
        },
        buildNaverMapUrls(restaurant) {
            const loc = restaurant.DetailShortInfo.locList && restaurant.DetailShortInfo.locList[0];
            if (!loc || !loc.latud || !loc.lgtud) {
                return { app: '#', web: '#' };
            }
            const name = restaurant.DetailShortInfo.faciltNameCN || 'N/A';
            const encodedName = encodeURIComponent(name);
            return {
                app: `nmap://place?lat=${loc.latud}&lng=${loc.lgtud}&name=${encodedName}&appname=com.max.everland`,
                web: `http://map.naver.com/v5/search/${encodedName}/place/?lat=${loc.latud}&lng=${loc.lgtud}`
            };
        },
        handleOpenNaverMap(restaurant) {
            const { app, web } = this.buildNaverMapUrls(restaurant);
            this.openNaverMap(app, web);
        },
        handleOpenRestroomSearch() {
            const keyword = '화장실';
            const encodedKeyword = encodeURIComponent(keyword);
            const appUrl = `nmap://search?query=${encodedKeyword}&appname=com.max.everland`;
            const webUrl = `https://map.naver.com/p/search/${encodedKeyword}`;
            this.openNaverMap(appUrl, webUrl);
        },
        openNaverMap(url, webUrl) {
            const start = new Date().getTime();
            window.location.href = url;
            setTimeout(() => {
                const end = new Date().getTime();
                if (document.hidden || end - start >= 2000) {
                    return;
                }
                window.open(webUrl, '_blank');
            }, 1500);
        },
        openImageModalFromRestaurant(restaurant, index) {
            const images = this.getBannerImages(restaurant);
            if (!images.length) {
                return;
            }
            this.openImageModal(images, index);
        },
        openImageModal(images, startIndex = 0) {
            if (!Array.isArray(images) || images.length === 0) {
                return;
            }

            const normalizedIndex = Math.min(Math.max(startIndex, 0), images.length - 1);

            this.modalImages = images.slice();
            this.modalImageIndex = normalizedIndex;
            this.modalTouchStartX = null;
            this.updateModalImage();
            this.imageModalVisible = true;

            this.$nextTick(() => {
                const modal = this.$refs.imageModal;
                if (modal) {
                    modal.focus();
                }
            });
        },
        closeImageModal() {
            this.imageModalVisible = false;
            this.selectedImageUrl = '';
            this.modalImages = [];
            this.modalImageIndex = 0;
            this.modalTouchStartX = null;
        },
        updateModalImage() {
            this.selectedImageUrl = this.modalImages[this.modalImageIndex] || '';
        },
        showPrevModalImage() {
            if (!this.hasPrevModalImage) {
                return;
            }
            this.modalImageIndex -= 1;
            this.updateModalImage();
        },
        showNextModalImage() {
            if (!this.hasNextModalImage) {
                return;
            }
            this.modalImageIndex += 1;
            this.updateModalImage();
        },
        handleModalTouchStart(event) {
            if (!event.changedTouches || !event.changedTouches.length) {
                return;
            }
            this.modalTouchStartX = event.changedTouches[0].clientX;
        },
        handleModalTouchEnd(event) {
            if (
                this.modalTouchStartX === null ||
                !event.changedTouches ||
                !event.changedTouches.length
            ) {
                return;
            }

            const endX = event.changedTouches[0].clientX;
            const deltaX = endX - this.modalTouchStartX;

            this.modalTouchStartX = null;

            const SWIPE_THRESHOLD = 40;

            if (Math.abs(deltaX) < SWIPE_THRESHOLD) {
                return;
            }

            if (deltaX > 0) {
                this.showPrevModalImage();
            } else {
                this.showNextModalImage();
            }
        },
        openMenuModal(faciltId) {
            const restaurant = this.allRestaurants.find(r => r.DetailShortInfo.faciltId === faciltId);
            if (!restaurant) {
                return;
            }
            this.selectedMenuRestaurant = restaurant;
            this.menuModalVisible = true;
        },
        closeMenuModal() {
            this.menuModalVisible = false;
            this.selectedMenuRestaurant = null;
        }
    },
    mounted() {
        this.loadData();
        if (typeof window !== 'undefined') {
            this.handleResize();
            window.addEventListener('resize', this.handleResize);
        }
    },
    beforeUnmount() {
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this.handleResize);
        }
    }
}).mount('#app');
