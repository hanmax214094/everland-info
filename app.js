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
            isLoading: true,
            imageModalVisible: false,
            selectedImageUrl: '',
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
        openImageModal(url) {
            this.selectedImageUrl = url;
            this.imageModalVisible = true;
        },
        closeImageModal() {
            this.imageModalVisible = false;
            this.selectedImageUrl = '';
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
    }
}).mount('#app');
