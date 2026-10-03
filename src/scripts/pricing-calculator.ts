import {availableSizes, capability, productFor, estimateCapacity, allowsHighAvailability} from '../utils/capacity-pricing.mjs';

type Resource = 'cluster' | 'application';
type Row = {type: Resource; size: string; ha: boolean};
const data = document.getElementById('capacity-catalog');
if (data) {
    const catalog = JSON.parse(data.textContent!);
    document.querySelectorAll<HTMLElement>('[data-plan-card]').forEach(card => {
        const planId = card.dataset.planCard!;
        const plan = catalog.offers.find((offer: any) => offer.plan.planId === planId).subscription;
        const policy = plan.capacityPolicy;
        const pro = !!catalog.offers.find((offer: any) => offer.plan.planId === planId).plan.details.basePlanId;
        const calculator = card.querySelector<HTMLElement>('[data-plan-calculator]')!;
        const front = card.querySelector<HTMLElement>('.pricing-v2-flip-face--front')!;
        const back = card.querySelector<HTMLElement>('.pricing-v2-flip-face--back')!;
        const inner = card.querySelector<HTMLElement>('.pricing-v2-flip-inner')!;
        const trigger = card.querySelector<HTMLButtonElement>('.scale-calc-trigger')!;
        const backButton = card.querySelector<HTMLButtonElement>('.scale-calculator-back')!;
        const input = (selector: string) => calculator.querySelector<HTMLInputElement>(selector)!;
        const storage = input('[data-scale-storage-gb]');
        const storageRange = input('[data-scale-storage-range]');
        const seats = input('[data-scale-seats]');
        const container = calculator.querySelector<HTMLElement>('[data-scale-rows]')!;
        const error = calculator.querySelector<HTMLElement>('[data-calculator-error]')!;
        const money = (value: number) => new Intl.NumberFormat('en-GB', {style: 'currency', currency: plan.currency, maximumFractionDigits: 2}).format(value);
        const sizes = (type: Resource): string[] => availableSizes(catalog, plan, type);
        const name = (type: Resource, size: string): string => productFor(catalog, type, size).details.description.replace(/ (cluster|application)$/, '');
        const state: Row[] = (['cluster', 'application'] as Resource[]).map(type => ({
            type, size: catalog.products.find((product: any) => product.productId === capability(plan, `${type}.`, true).productId).details.size, ha: false
        }));
        const output = (selector: string, amount: number) => { calculator.querySelector<HTMLElement>(selector)!.textContent = money(amount); };
        const focusVisibleFace = () => (card.classList.contains('is-flipped') ? backButton : trigger).focus({preventScroll: true});
        inner.addEventListener('transitionend', event => {
            if (event.target === inner && event.propertyName === 'transform') focusVisibleFace();
        });

        function showCalculator(open: boolean) {
            card.classList.toggle('is-flipped', open);
            front.inert = open;
            back.inert = !open;
            (open ? back : front).removeAttribute('aria-hidden');
            (open ? front : back).setAttribute('aria-hidden', 'true');
            trigger.setAttribute('aria-expanded', String(open));
            if (matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(focusVisibleFace);
        }
        trigger.addEventListener('click', () => showCalculator(true));
        backButton.addEventListener('click', () => showCalculator(false));
        back.addEventListener('keydown', event => { if (event.key === 'Escape') showCalculator(false); });

        function updateTotals() {
            try {
                if (!storage.value || !seats.value || !storage.validity.valid || !seats.validity.valid) throw new Error('Enter valid storage and seat amounts.');
                const result = estimateCapacity(catalog, planId, state, Number(seats.value), Number(storage.value), 30);
                container.querySelectorAll<HTMLElement>('[data-row-price]').forEach((element, index) => { element.textContent = money(result.lines[index].amount); });
                output('[data-scale-storage-extra]', result.storageAmount);
                output('[data-scale-seat-extra]', result.seatAmount);
                output('[data-scale-extra-total]', result.capacity + result.storageAmount + result.seatAmount);
                output('[data-scale-total]', result.total);
                storageRange.value = String(Math.min(Number(storageRange.max), Math.max(Number(storageRange.min), Number(storage.value))));
                error.textContent = '';
            } catch (problem) {
                error.textContent = problem instanceof Error ? problem.message : 'Check your capacity choices.';
                calculator.querySelector<HTMLElement>('[data-scale-total]')!.textContent = '—';
            }
        }

        function renderRows() {
            container.replaceChildren();
            const counts = {cluster: 0, application: 0};
            state.forEach((item, rowIndex) => {
                const count = ++counts[item.type];
                const typeName = item.type === 'application' ? 'app' : 'cluster';
                const row = document.createElement('div');
                row.className = 'scale-row';
                const main = document.createElement('div');
                main.className = 'scale-row-main';
                const badge = document.createElement('span');
                badge.className = `scale-row-type scale-row-type--${typeName}`;
                const resourceLabel = pro ? `${typeName} ${count}` : typeName;
                badge.textContent = resourceLabel;
                const sizeBadge = document.createElement('span');
                sizeBadge.className = 'scale-row-size';
                sizeBadge.textContent = name(item.type, item.size);
                main.append(badge, sizeBadge);
                const actions = document.createElement('div');
                actions.className = 'scale-row-actions';
                const price = document.createElement('strong');
                price.className = 'scale-row-price';
                price.dataset.rowPrice = '';
                actions.append(price);
                if (count > 1) {
                    const remove = document.createElement('button');
                    remove.type = 'button'; remove.className = 'scale-row-remove'; remove.textContent = '×';
                    remove.setAttribute('aria-label', `Remove ${plan.displayName} ${typeName} ${count}`);
                    remove.addEventListener('click', () => {
                        state.splice(rowIndex, 1); renderRows(); updateTotals();
                        calculator.querySelector<HTMLButtonElement>(`[data-add-scale-row="${item.type}"]`)?.focus({preventScroll: true});
                    });
                    actions.append(remove);
                }
                const allowed = sizes(item.type);
                const range = document.createElement('input');
                range.className = 'scale-row-range'; range.type = 'range';
                range.min = '0'; range.max = String(allowed.length - 1); range.step = '1';
                range.value = String(allowed.indexOf(item.size));
                range.setAttribute('aria-label', `${plan.displayName} ${resourceLabel} size`);
                range.setAttribute('aria-valuetext', name(item.type, item.size));
                row.append(main, actions, range);
                let ha: HTMLInputElement | undefined;
                if (item.type === 'cluster' && policy.highAvailability) {
                    const option = document.createElement('div'); option.className = 'scale-ha-option';
                    const label = document.createElement('label'); label.className = 'scale-ha-choice';
                    ha = document.createElement('input'); ha.type = 'checkbox'; ha.checked = item.ha;
                    ha.setAttribute('aria-label', `${plan.displayName} cluster ${count} high availability`);
                    ha.disabled = !allowsHighAvailability(policy, item.size);
                    ha.addEventListener('change', () => { item.ha = ha!.checked; updateTotals(); });
                    label.append(ha, document.createTextNode('High availability'));
                    const info = document.createElement('details'); info.className = 'scale-info';
                    const summary = document.createElement('summary'); summary.textContent = 'i';
                    summary.setAttribute('aria-label', `About high availability for cluster ${count}`);
                    const explanation = document.createElement('p');
                    explanation.textContent = 'Adds redundant data and network components. Available for Medium and larger clusters. The extra cost is included in the estimate. Additional storage charges may apply.';
                    info.append(summary, explanation);
                    info.addEventListener('keydown', event => {
                        if (event.key === 'Escape' && info.open) {
                            info.open = false; summary.focus(); event.stopPropagation();
                        }
                    });
                    option.append(label, info);
                    row.append(option);
                }
                range.addEventListener('input', () => {
                    item.size = allowed[Number(range.value)];
                    sizeBadge.textContent = name(item.type, item.size);
                    range.setAttribute('aria-valuetext', sizeBadge.textContent);
                    if (ha) {
                        ha.disabled = !allowsHighAvailability(policy, item.size);
                        if (ha.disabled) item.ha = ha.checked = false;
                    }
                    updateTotals();
                });
                container.append(row);
            });
            calculator.querySelectorAll<HTMLButtonElement>('[data-add-scale-row]').forEach(button => {
                const type = button.dataset.addScaleRow as Resource;
                const maximum = type === 'cluster' ? policy.maximumClusters : policy.maximumApplications;
                button.disabled = maximum != null && counts[type] >= maximum;
            });
        }

        calculator.querySelectorAll<HTMLButtonElement>('[data-add-scale-row]').forEach(button => {
            button.addEventListener('click', () => {
                const type = button.dataset.addScaleRow as Resource;
                const maximum = type === 'cluster' ? policy.maximumClusters : policy.maximumApplications;
                if (maximum != null && state.filter(row => row.type === type).length >= maximum) return;
                state.push({type, size: sizes(type)[0], ha: false});
                renderRows(); updateTotals();
            });
        });
        storage.addEventListener('input', updateTotals);
        seats.addEventListener('input', updateTotals);
        storageRange.addEventListener('input', () => { storage.value = storageRange.value; updateTotals(); });
        renderRows(); updateTotals();
    });
}
