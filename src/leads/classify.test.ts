import { describe, expect, it } from "vitest";
import { detectEmployment, detectLanguage, detectWorkMode, findCountries, offersVisa } from "./classify";

describe("findCountries", () => {
  it.each([
    ["Berlin, Germany", "Germany"],
    ["München", "Germany"],
    ["Москва", "Russia"],
    ["São Paulo", "Brazil"],
    ["Dhaka", "Bangladesh"],
    ["NYC or remote", "United States"],
  ])("%s → %s", (text, country) => {
    expect(findCountries(text)[0]).toBe(country);
  });

  it("doesn't read the English word 'us' as a country", () => {
    expect(findCountries("Join us in building")).toEqual([]);
  });
});

describe("detectWorkMode", () => {
  it.each([
    ["Fully remote team", "REMOTE"],
    ["Можно удалённо", "REMOTE"],
    ["[Híbrido] Desenvolvedor", "HYBRID"],
    ["100% Homeoffice möglich", "REMOTE"],
    ["Office in Paris, no remote", "ONSITE"],
    ["Office in Paris", "ONSITE"],
  ])("%s → %s", (text, mode) => {
    expect(detectWorkMode(text)).toBe(mode);
  });
});

describe("detectEmployment", () => {
  it("trusts the headline and only explicit phrases in the body", () => {
    expect(detectEmployment("Backend dev | Contract")).toBe("CONTRACT");
    expect(detectEmployment("Senior PHP-Entwickler (Vollzeit)")).toBe("FULL_TIME");
    expect(detectEmployment("Backend dev", "We write smart contracts and contract tests.")).toBe("UNKNOWN");
    expect(detectEmployment("Backend dev", "This is a 6-month contract.")).toBe("CONTRACT");
    expect(detectEmployment("Dev", "Полный рабочий день")).toBe("FULL_TIME");
  });
});

describe("offersVisa", () => {
  it("spots sponsorship in several languages and respects 'no sponsorship'", () => {
    expect(offersVisa("We provide visa sponsorship")).toBe(true);
    expect(offersVisa("Помощь с релокацией")).toBe(true);
    expect(offersVisa("Blue Card möglich")).toBe(true);
    expect(offersVisa("We cannot sponsor a visa")).toBe(false);
  });
});

describe("detectLanguage", () => {
  it.each([
    ["Wir suchen einen erfahrenen Entwickler für unser Team in Berlin. Du arbeitest mit uns an der Plattform und bist für die Weiterentwicklung zuständig.", "de"],
    ["Ищем опытного разработчика в команду. Вы будете работать над платформой и развивать внутренние сервисы компании.", "ru"],
    ["Estamos buscando um desenvolvedor para a nossa empresa. Você vai trabalhar com o time de produto em uma vaga remota.", "pt"],
    ["We are looking for a developer to join our team and work on the platform with us.", "en"],
  ])("%s", (text, lang) => {
    expect(detectLanguage(text)).toBe(lang);
  });
});
