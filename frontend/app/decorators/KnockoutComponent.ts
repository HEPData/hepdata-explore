// @KnockoutComponent class decorator
export function KnockoutComponent(componentName: string, config: any) {
    return function registerComponent(classConstructor: {new (params: any): any}) {
        config.viewModel = classConstructor;
        ko.components.register(componentName, config);
    }
}