import axios from "axios";

// 요청 중인지 상태를 저장할 객체
const pendingRequests = new Map();

// 이중 요청 금지에서 제외할 요청 키 목록
const excludeRequests = new Set(["get:/users", "get:/recipes"]);

// 요청을 등록하는 함수
const addRequest = (key) => {
  // 제외 요청이면 등록하지 않음
  if (excludeRequests.has(key)) return;
  if (!pendingRequests.has(key)) {
    pendingRequests.set(key, true);
  }
};

// 요청을 제거하는 함수
const removeRequest = (key) => {
  if (excludeRequests.has(key)) return;
  if (pendingRequests.has(key)) {
    pendingRequests.delete(key);
  }
};

// 요청 중인지 확인하는 함수
const hasPendingRequest = (key) => {
  if (excludeRequests.has(key)) return false; // 제외 요청은 항상 false 반환
  return pendingRequests.has(key);
};

// 공통 인터셉터 설정
const addInterceptors = (axiosInstance) => {
  axiosInstance.interceptors.request.use((config) => {
    const requestKey = `${config.method}:${config.url}`;

    // 요청 중인 URL이면 요청 차단 (재요청 플래그는 무시)
    if (!config._retry && hasPendingRequest(requestKey)) {
      return Promise.reject(new Error("Request already in progress"));
    }

    addRequest(requestKey);
    return config;
  });

  axiosInstance.interceptors.response.use(
    (response) => {
      const requestKey = `${response.config.method}:${response.config.url}`;
      removeRequest(requestKey); // 요청 완료 후 상태 제거
      return response;
    },
    (error) => {
      const requestKey =
        error.config && `${error.config.method}:${error.config.url}`;
      if (requestKey) removeRequest(requestKey); // 에러 발생 시에도 상태 제거
      return Promise.reject(error);
    }
  );
};

// 일반 axios 인스턴스
export const generalAxios = axios.create({
  baseURL: "/",
});

// API 요청용 axios 인스턴스
export const apiAxios = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

// token 재발급
let isRefreshing = false;
let refreshSubscribers = [];

// 재발급 후 대기 중인 요청을 다시 실행
function onRefreshed() {
  refreshSubscribers.forEach((callback) => callback());
  refreshSubscribers = [];
}

// 재발급 중인 요청을 구독
function addRefreshSubscriber(callback) {
  refreshSubscribers.push(callback);
}

// 응답 인터셉터 추가
apiAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          addRefreshSubscriber(() => {
            resolve(apiAxios(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await generalAxios.post("/api/auth/token");
        onRefreshed();
        isRefreshing = false;

        // 재요청의 경우 다중 요청 방지에서 제외하도록 설정
        originalRequest._retry = true; // 재발급 요청이므로 중복 체크 생략
        return apiAxios(originalRequest);
      } catch (err) {
        isRefreshing = false;
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

// generalAxios와 apiAxios에 인터셉터 추가
addInterceptors(generalAxios);
addInterceptors(apiAxios);
